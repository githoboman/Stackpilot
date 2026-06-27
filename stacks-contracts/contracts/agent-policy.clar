;; agent-policy.clar
;; On-chain constraint layer for the Stackpilot autonomous agent wallet.
;; Faithful Clarity port of the Sui `agent_policy::policy` Move module:
;; budget cap, protocol whitelist, asset scope, action scope, expiry, pause, revoke.
;;
;; Clarity serializes contract calls, so the budget increment in record-spend is
;; race-free natively - the equivalent of the Sui shared-object sequencing that made
;; record_spend the hard limit.

;; --- Error codes (mirror the Move ENotOwner=1 ... numbering) -------------
(define-constant ERR-NOT-OWNER        (err u1))
(define-constant ERR-INACTIVE         (err u2))
(define-constant ERR-EXPIRED          (err u3))
(define-constant ERR-BUDGET-EXCEEDED  (err u4))
(define-constant ERR-PROTO-NOT-OK     (err u5))
(define-constant ERR-ASSET-NOT-OK     (err u6))
(define-constant ERR-ACTION-NOT-OK    (err u7))
(define-constant ERR-NOT-AGENT        (err u8))
(define-constant ERR-INVALID-BUDGET   (err u9))
(define-constant ERR-INVALID-EXPIRY   (err u10))
(define-constant ERR-TOO-EARLY        (err u11))
(define-constant ERR-REVOKED          (err u12))
(define-constant ERR-NOT-FOUND        (err u13))

;; Action ids (mirror events.move): 0=SWAP, 1=LIMIT_ORDER, 2=CANCEL, 3=CLAIM_FILL.
;; Asset-scope is only enforced for value-moving actions (SWAP / LIMIT_ORDER).
(define-constant ACTION-SWAP   u0)
(define-constant ACTION-LIMIT  u1)

(define-data-var policy-nonce uint u0)

;; One policy per id. Whitelists are short bounded lists with exact-match membership,
;; matching the Move side's vector::contains over ascii strings.
(define-map policies uint {
  owner: principal,
  agent: principal,
  budget-cap: uint,
  budget-spent: uint,
  allowed-protocols: (list 5 (string-ascii 128)),
  allowed-assets:    (list 8 (string-ascii 64)),
  allowed-actions:   (list 4 uint),
  expiry-burn-height: uint,   ;; burn-block-height at/after which the policy is expired
  active: bool,
  revoked: bool,
  created-at: uint
})

;; --- Creation -----------------------------------------------------------
;; Owner creates a policy bound to an agent principal. Returns the new policy-id.
;; The Sui version returned an AgentCapability object delegated to the agent; here
;; the agent principal is stored in the policy and `revoked` is the hard-stop flag.
(define-public (create-policy
    (agent principal)
    (budget-cap uint)
    (allowed-protocols (list 5 (string-ascii 128)))
    (allowed-assets    (list 8 (string-ascii 64)))
    (allowed-actions   (list 4 uint))
    (expiry-burn-height uint))
  (let ((id (+ (var-get policy-nonce) u1)))
    (asserts! (> budget-cap u0) ERR-INVALID-BUDGET)
    (asserts! (> expiry-burn-height burn-block-height) ERR-INVALID-EXPIRY)
    (map-set policies id {
      owner: tx-sender,
      agent: agent,
      budget-cap: budget-cap,
      budget-spent: u0,
      allowed-protocols: allowed-protocols,
      allowed-assets: allowed-assets,
      allowed-actions: allowed-actions,
      expiry-burn-height: expiry-burn-height,
      active: true,
      revoked: false,
      created-at: burn-block-height
    })
    (var-set policy-nonce id)
    (print { event: "policy-created", id: id, owner: tx-sender, agent: agent,
             budget-cap: budget-cap, expiry: expiry-burn-height })
    (ok id)))

;; --- Validation (read-only mirror of Sui validate_action) ----------------
;; Checks EVERY constraint and returns an err on the first violation - the same AND
;; logic as the Move assert! chain. record-spend calls this with try!, so an invalid
;; action never mutates state.
(define-read-only (validate
    (id uint) (caller principal) (action uint)
    (amount uint) (protocol (string-ascii 128)) (asset (string-ascii 64)))
  (let ((p (unwrap! (map-get? policies id) ERR-NOT-FOUND)))
    (asserts! (not (get revoked p)) ERR-REVOKED)
    (asserts! (is-eq caller (get agent p)) ERR-NOT-AGENT)
    (asserts! (get active p) ERR-INACTIVE)
    (asserts! (< burn-block-height (get expiry-burn-height p)) ERR-EXPIRED)
    (asserts! (is-some (index-of (get allowed-actions p) action)) ERR-ACTION-NOT-OK)
    (asserts! (is-some (index-of (get allowed-protocols p) protocol)) ERR-PROTO-NOT-OK)
    ;; Asset scope only applies to value-moving actions (swap/limit), matching Move.
    (asserts! (or (and (not (is-eq action ACTION-SWAP)) (not (is-eq action ACTION-LIMIT)))
                  (is-some (index-of (get allowed-assets p) asset))) ERR-ASSET-NOT-OK)
    (asserts! (<= (+ (get budget-spent p) amount) (get budget-cap p)) ERR-BUDGET-EXCEEDED)
    (ok true)))

;; --- Spend accounting (atomic - agent-only, re-checks every constraint) --
;; Clarity serializes contract calls, so the read-then-increment below is race-free:
;; two concurrent agent calls are sequenced and the second sees the updated spent.
(define-public (record-spend
    (id uint) (action uint) (amount uint)
    (protocol (string-ascii 128)) (asset (string-ascii 64)))
  (let ((p (unwrap! (map-get? policies id) ERR-NOT-FOUND)))
    (try! (validate id tx-sender action amount protocol asset))
    (let ((new-spent (+ (get budget-spent p) amount)))
      (map-set policies id (merge p { budget-spent: new-spent }))
      (print { event: "spend-recorded", id: id, amount: amount,
               spent: new-spent, cap: (get budget-cap p) })
      (ok new-spent))))

;; Time-gated variant for scheduled / auto-DCA runs (mirror validate_action_after).
;; The burn-height gate makes the chain - not the backend timer - the authority on
;; "not before", so an early/replayed trigger still can't execute prematurely.
(define-public (record-spend-after
    (id uint) (action uint) (amount uint)
    (protocol (string-ascii 128)) (asset (string-ascii 64))
    (execute-after-burn uint))
  (begin
    (asserts! (>= burn-block-height execute-after-burn) ERR-TOO-EARLY)
    (record-spend id action amount protocol asset)))

;; --- Owner controls -----------------------------------------------------
;; revoke is the hard stop: it flips `revoked`, after which the agent's next
;; record-spend aborts at the (not (get revoked p)) assert with ERR-REVOKED. This is
;; the Clarity analogue of Sui destroying the AgentCapability object.
(define-public (revoke (id uint))
  (let ((p (unwrap! (map-get? policies id) ERR-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get owner p)) ERR-NOT-OWNER)
    (map-set policies id (merge p { active: false, revoked: true }))
    (print { event: "policy-revoked", id: id, owner: tx-sender, height: burn-block-height })
    (ok true)))

(define-public (pause (id uint))
  (let ((p (unwrap! (map-get? policies id) ERR-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get owner p)) ERR-NOT-OWNER)
    (map-set policies id (merge p { active: false }))
    (print { event: "policy-paused", id: id, active: false, height: burn-block-height })
    (ok true)))

(define-public (resume (id uint))
  (let ((p (unwrap! (map-get? policies id) ERR-NOT-FOUND)))
    (asserts! (is-eq tx-sender (get owner p)) ERR-NOT-OWNER)
    (asserts! (not (get revoked p)) ERR-REVOKED)
    (asserts! (< burn-block-height (get expiry-burn-height p)) ERR-EXPIRED)
    (map-set policies id (merge p { active: true }))
    (print { event: "policy-paused", id: id, active: true, height: burn-block-height })
    (ok true)))

;; --- Views --------------------------------------------------------------
(define-read-only (get-policy (id uint)) (map-get? policies id))

(define-read-only (get-nonce) (var-get policy-nonce))

(define-read-only (remaining-budget (id uint))
  (match (map-get? policies id) p
    (ok (- (get budget-cap p) (get budget-spent p)))
    ERR-NOT-FOUND))

(define-read-only (is-expired (id uint))
  (match (map-get? policies id) p
    (ok (>= burn-block-height (get expiry-burn-height p)))
    ERR-NOT-FOUND))
