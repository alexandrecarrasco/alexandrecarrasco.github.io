---
title: Glossary
layout: glossary
description: "The identity and access terms used on this blog, each in one or two plain sentences, with the post that explains it."
lastChecked: 2026-11-18
---

The terms used on this blog, in plain words. Each one links to the post that explains it in context.

## Parties

### Agent {#agent}
Software that uses a language model to decide which tool to call, and with which arguments, while it runs. In MCP it is the client. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### Agent registry {#agent-registry}
A record of which agents exist, who owns each one, and whether it is active. No open standard defines one yet. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/#the-agent-registry).

### Authorization server {#authorization-server}
The service that issues tokens. In OAuth it decides whether a client may get a token, for which user and for which resource. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### MCP server {#mcp-server}
The service that exposes tools to an agent through the Model Context Protocol. In OAuth terms it is a resource server: it must only accept tokens issued for it. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### Gateway {#gateway}
An intermediary in front of one or more MCP servers that every tool call passes through. In this blog's design it is the policy enforcement point. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### Policy enforcement point (PEP) {#pep}
The component that holds a request, asks for a decision, and lets the request through or stops it. It does not decide. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### Policy decision point (PDP) {#pdp}
The component that holds the policy and answers whether a specific request is allowed. It never sees the traffic, only the question. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### Signal receiver {#signal-receiver}
In this blog's design, the component that receives Shared Signals events and records what they say where the PDP can use it. It is the SSF Receiver. See [Part 2](/posts/securing-ai-agents-part-2-shared-signals/).

### Workload {#workload}
Software running for a specific purpose, possibly as several instances, such as a service or an agent. The WIMSE work treats agents as workloads. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/#where-the-key-comes-from-workload-identity).

## Tokens and claims

### Access token {#access-token}
A credential an authorization server issues so a client can call a resource. It says who it was issued to, for which user, and for which resource.

### Bearer token {#bearer-token}
A token that works for whoever holds it, without any proof that they are the one it was issued to. A copy taken from a log works just as well as the original. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/).

### Audience {#audience}
Who a token was issued for, in its `aud` claim. A resource must refuse a token whose audience is not itself. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### Resource parameter {#resource-parameter}
The `resource` parameter (RFC 8707) a client sends when it asks for a token, to name the service it will use the token with. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### `act` claim {#act-claim}
A claim in a token that records who is acting on behalf of the subject. Nested `act` claims record a chain of actors; only the outermost one counts for access decisions. See [Part 3](/posts/securing-ai-agents-part-3-delegation/#reading-the-act-claim).

### `cnf` claim {#cnf-claim}
The confirmation claim: it binds a token to a key (`jkt`, for DPoP) or to a certificate (`x5t#S256`, for mutual TLS). See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/).

### Security Event Token (SET) {#set}
A signed JWT that carries an event, such as "this account was disabled", from one system to another (RFC 8417). See [Part 2](/posts/securing-ai-agents-part-2-shared-signals/).

## Standards and techniques

### Model Context Protocol (MCP) {#mcp}
The protocol agents use to discover and call tools on MCP servers. Its authorization specification builds on OAuth 2.1. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### OAuth 2.1 {#oauth}
An update to OAuth 2.0, the framework for issuing and using access tokens, that folds in the security practices learned since. It is still an IETF draft. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### AuthZEN {#authzen}
The OpenID Foundation's Authorization API: a standard way for a PEP to ask a PDP whether a subject may perform an action on a resource. It standardizes the question, not the policy language. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### COAZ-MCP {#coaz-mcp}
An OpenID working group draft that maps each MCP request to an AuthZEN question, and says what the PEP does with the answer. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/).

### Fail closed {#fail-closed}
When a check cannot be made, for example because the PDP is unreachable, the request is refused rather than let through. See [Part 1](/posts/securing-ai-agents-part-1-building-blocks/#the-same-flow-a-different-answer).

### Shared Signals Framework (SSF) {#ssf}
The OpenID standard for one system to tell another, as it happens, that something has changed. A Transmitter sends events over a stream; a Receiver acts on them. See [Part 2](/posts/securing-ai-agents-part-2-shared-signals/).

### CAEP {#caep}
The Continuous Access Evaluation Profile: Shared Signals events about sessions and access, such as a revoked session or a change in risk. See [Part 2](/posts/securing-ai-agents-part-2-shared-signals/).

### RISC {#risc}
Risk Incident Sharing and Coordination: Shared Signals events about accounts, such as a disabled account or a compromised credential. See [Part 2](/posts/securing-ai-agents-part-2-shared-signals/).

### Token introspection {#token-introspection}
Asking the authorization server whether a token is still active (RFC 7662). It adds a request on every call and only answers about the token itself. See [Part 2](/posts/securing-ai-agents-part-2-shared-signals/).

### Token Exchange {#token-exchange}
OAuth 2.0 Token Exchange (RFC 8693): presenting one token to the authorization server to get another, for example for a different audience, while recording who is acting for whom. See [Part 3](/posts/securing-ai-agents-part-3-delegation/).

### Delegation and impersonation {#delegation}
In delegation, the actor keeps its own identity and acts on behalf of someone else. In impersonation, it becomes indistinguishable from them. See [Part 3](/posts/securing-ai-agents-part-3-delegation/).

### Transaction Tokens {#transaction-tokens}
Short-lived tokens that carry a request's identity and context between services inside one trust domain. An IETF draft. See [Part 3](/posts/securing-ai-agents-part-3-delegation/#inside-the-payments-service-transaction-tokens).

### Identity chaining {#identity-chaining}
Carrying identity across trust domains: a token exchange in one domain produces a grant that the other domain's authorization server accepts. See [Part 3](/posts/securing-ai-agents-part-3-delegation/#across-domains-when-the-api-has-its-own-authorization-server).

### Proof of possession {#proof-of-possession}
Binding a token to a key or certificate, so that whoever presents it must also prove they hold the key. Also called sender-constraining. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/).

### DPoP {#dpop}
Demonstrating Proof of Possession (RFC 9449): the client signs a short proof with its private key on every request, and the token is bound to that key. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/).

### Mutual TLS {#mtls}
TLS in which the client also presents a certificate. RFC 8705 uses it to bind tokens to that certificate. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/#mutual-tls-instead-of-dpop).

### WIMSE {#wimse}
Workload Identity in Multi System Environments, an IETF working group defining how workloads get an identifier, a credential with a key, and a way to prove it. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/#where-the-key-comes-from-workload-identity).

### SPIFFE {#spiffe}
An open-source set of standards, widely deployed, that gives workloads short-lived cryptographic identities called SVIDs. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/#where-the-key-comes-from-workload-identity).

### Attestation {#attestation}
Evidence that a piece of software is in the state it should be, checked before trusting it. The IETF's RATS architecture (RFC 9334) describes it. See [Part 4](/posts/securing-ai-agents-part-4-proof-of-possession/).
