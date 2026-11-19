---
title: "Securing AI Agents, Layer by Layer - Part 4: Proof of Possession"
linkTitle: "Proof of Possession"
lastChecked: 2026-11-18   # when the facts and statuses were last verified against the sources
updates:
  - date: 2026-11-19
    note: "Rewritten to be easier to read. The facts, examples and sources are the same."
inShort:
  - "Every token so far is a bearer token: a copy taken from a log works for anyone."
  - "DPoP or mutual TLS binds a token to a key, so a stolen token without the key is refused at the gateway."
  - "Neither stops a manipulated agent, which signs its own calls; that stays the PDP's job. The agent's key should come from its own workload identity."
date: 2026-11-18T12:24:00Z
lastmod: 2026-11-19
draft: false
weight: 4
toc: true
aliases: ["/blogs/securing-ai-agents-part-4-proof-of-possession/"]
series: "Securing AI Agents, Layer by Layer"
tags: ["ai-agents", "oauth", "mcp", "workload-identity"]
description: "Every token so far is a bearer token: whoever holds it can use it. DPoP and mutual TLS bind a token to a key, so a copied token alone is useless."
summary: "Every token in this design so far is a bearer token, which means that whoever holds it can use it. This post binds each token to a key that only the agent holds, using DPoP or mutual TLS, so that a token copied out of a log is useless on its own. It also explains what this does not stop, and where the agent's key should come from, which is the agent's own workload identity."
---

Every token in this design so far is a bearer token, which means that whoever holds it can use it. This post binds each token to a key that only the agent holds, using DPoP or mutual TLS, so that a token copied out of a log is useless on its own. It also explains what this does not stop, and where the agent's key should come from, which is the agent's own workload identity.

*This series builds one design, one layer at a time. [The first post](/posts/securing-ai-agents-part-1-building-blocks/) introduced the building blocks, [the second](/posts/securing-ai-agents-part-2-shared-signals/) kept them informed after the token was issued, and [the third](/posts/securing-ai-agents-part-3-delegation/) added the hop after the MCP server. This post changes the tokens themselves. It keeps the same example and the same step numbers. When I quote a specification, words such as MUST, SHOULD and MAY are the specification's own. When the advice is mine, I say so. The terms are explained in the [glossary](/glossary/).*

## The problem: a token that leaves

OAuth defines a [bearer token](/glossary/#bearer-token) in [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html), and the definition already describes the problem: "A security token with the property that any party in possession of the token (a "bearer") can use the token in any way that any other party in possession of it can. Using a bearer token does not require a bearer to prove possession of cryptographic key material (proof-of-possession)."

The MCP specification names the risk that follows, under the heading "Token Theft": "Attackers who obtain tokens stored by the client, or tokens cached or logged on the server can access protected resources with requests that appear legitimate to resource servers."

To see what that means in this design, put times on the example, as the second post did. This is a different day, and nothing happens to Alice's account.

- **10:00.** The [authorization server](/glossary/#authorization-server) issues a token to Alice's agent (step 4).
- **10:03.** A debugging proxy in front of the agent logs the request headers, and the token is in them. Someone who should not read that log reads it.
- **10:04.** From another machine, that person sends a `tools/call` request for `list_invoices` to the gateway, with Alice's token.

Now follow the 10:04 call through the checks. The gateway validates the token, and the signature, the issuer, the audience and the expiry are all fine. The policy in the first post only covered payments, so I add one more rule of my own here: *an agent may read the invoices of the user it acts for.* The PDP sees Alice, her finance assistant, and a request to read her own invoices, so it answers `true`. The MCP server sees a token that was issued for it. Alice's account has not been disabled, so no signal is sent.

Every check passed, and Alice's invoices, including her payees' bank details, went to someone else. The reason is that nobody asked who sent the request. Every check in this design looks at what the token says, and none of them looks at who is holding it.

The MCP specification's answer is to make the tokens expire sooner: "Authorization servers SHOULD issue short-lived access tokens to reduce the impact of leaked tokens." As the second post said, that makes the window smaller, but it does not close it.

## Binding the token to a key

The fix is to issue the token to a key, and not to whoever happens to hold the token. OAuth calls this sender-constraining, and it has two standards for it:

- **[DPoP](/glossary/#dpop)** ([RFC 9449](https://www.rfc-editor.org/rfc/rfc9449.html), September 2023) works at the application level, in HTTP headers.
- **[Mutual TLS](/glossary/#mtls)** ([RFC 8705](https://www.rfc-editor.org/rfc/rfc8705.html), February 2020) works at the transport level, with client certificates.

The DPoP specification states the goal: "The primary aim of DPoP is to prevent unauthorized or illegitimate parties from using leaked or stolen access tokens, by binding a token to a public key upon issuance and requiring that the client proves possession of the corresponding private key when using the token."

This post follows DPoP through the flow, because DPoP also works when the agent runs outside your own network. [A later section](#mutual-tls-instead-of-dpop) covers mutual TLS.

## The flow, with a key

{{< diagram src="/images/posts/part4-proof-of-possession.svg" mobile="/images/posts/part4-proof-of-possession-mobile.svg" caption="The whole flow, from step 0. Highlighted: what this post adds." >}}

Before step 2, the agent generates a key pair. The private key never leaves the agent, and [a later section](#where-the-key-comes-from-workload-identity) explains where it should be kept. After that, three steps from the first post change: steps 2, 4 and 5.

**Step 2.** When the agent asks for its token, it adds a `DPoP` header to the request. The header holds a DPoP proof, which is a short JWT that the agent signs with its private key and that carries the matching public key in its header.

**Step 4.** The authorization server binds the token to that key. The token now carries a confirmation claim, `cnf`, which holds the thumbprint of the key:

```json
{
  "iss": "https://idp.example.com/",
  "aud": "https://finance-mcp.example.com/",
  "sub": "alice@example.com",
  "client_id": "finance-assistant",
  "iat": 1794909600,
  "exp": 1794909900,
  "cnf": {
    "jkt": "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I"
  }
}
```

The RFC defines `jkt` as the "JWK SHA-256 Thumbprint confirmation method". Its value is the thumbprint "of the DPoP public key (in JWK format) to which the access token is bound."

**Step 5.** On every call, the agent sends the token together with a new proof. The token goes in the `Authorization` header, with the `DPoP` scheme instead of `Bearer`. The proof goes in the `DPoP` header. When it is decoded, a proof looks like this:

```json
{
  "typ": "dpop+jwt",
  "alg": "ES256",
  "jwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "l8tFrhx-34tV3hRICRDY9zCkDlpBhF42UQUfWVAWBFs",
    "y": "9VE4jf_Ok_o64zbTTlcuNJajHmt6v9TDVrU0CdvGRDA"
  }
}
.
{
  "jti": "e1j3V_bKic8-LAEB",
  "htm": "POST",
  "htu": "https://finance-mcp.example.com/mcp",
  "iat": 1794909720,
  "ath": "fUHyO2r2Z3DZ53EsNrWBb0xWXoaNy59IiKCAqksmQEo"
}
```

Each claim in the proof has one job. `jti` is a "Unique identifier for the DPoP proof JWT". `htm` is "The value of the HTTP method" and `htu` is "The HTTP target URI", so together they tie the proof to one kind of request. `iat` is the "Creation timestamp of the JWT". `ath` is the "Hash of the access token", and it ties this proof to this token.

The gateway checks the proof before it asks the PDP anything. It checks that:

- the signature is valid for the public key in the proof;
- the thumbprint of that key matches `cnf.jkt` in the token;
- the method and the URL match this request;
- `ath` matches the token that the proof came with;
- the proof is recent;
- the `jti` has not been seen before.

The last two checks come from the RFC. It says that "servers MUST only accept DPoP proofs for a limited time after their creation (preferably only for a relatively brief period on the order of seconds or minutes)". It also says that servers "can store the jti value of each DPoP proof for the time window in which the respective DPoP proof JWT would be accepted to prevent multiple uses of the same DPoP proof."

After that, steps 6 to 11 run as they did in the first post. In this design, the gateway is the one that checks the proof. The MCP server behind it can check the proof as well, because the proof was made for the same address. Whether it does so is a deployment choice.

**The hop from the third post.** Token Exchange is a token request like any other, so the same mechanism applies at step 9a. The MCP server adds its own proof to the request, and the token for the payments API is bound to the MCP server's key, not to the agent's key. In this way, each hop has its own key.

## The stolen token, again

Go back to 10:04. The person with the copied token sends it to the gateway. They do not have a proof signed with the agent's key, and any proof that they make with a key of their own carries the wrong thumbprint. The gateway therefore refuses the call at step 5, with a `401` response. The PDP is never asked, and the MCP server never sees the request.

| The call | What decided it | Answer |
| --- | --- | --- |
| The agent calls `list_invoices` with its token and a fresh proof | The PDP, as in the first post | Allowed |
| Someone calls with the same token, copied from a log | The proof: no key, no call | Refused |
| Someone replays a proof captured with the token | The `jti` already seen, or the proof too old | Refused |

The token in the first row and the token in the second row are the same token. What changed the answer is a key, and the key does not travel with the token.

## What DPoP does not stop

DPoP stops a token that has left the agent. It does not stop the agent itself. The RFC says so directly, in its section on untrusted code in the client: "If an adversary is able to run code in the client's execution context, the security of DPoP is no longer guaranteed."

For a browser application, the RFC describes an attacker who does not steal the token, but uses it through the client: "That execution context has access to utilize the signing key; thus, it can produce DPoP proofs to use in conjunction with the token." The RFC treats that threat as out of scope.

For an agent, the same situation has a familiar name, which is prompt injection. A prompt injection that persuades the agent to call a tool does not steal anything. The agent makes the call itself, with its own key, and the proof is valid. DPoP cannot tell an honest call from a manipulated one. That is the job of step 7, where the PDP judges the call itself, whoever sent it. The two layers cover different failures, and neither one replaces the other.

What DPoP can do is make sure that the key does not leave together with the token. The RFC says: "If the private key used for DPoP is stored in such a way that it cannot be exported, e.g., in a hardware or software security module, the adversary cannot exfiltrate the key and use it to create arbitrary DPoP proofs." My advice: never keep the agent's private key in the same place as its tokens, such as the same file or the same environment variables. A key that sits next to the token is copied with it.

There are three more limits that are worth knowing:

- **Proofs made in advance.** Someone who controls the client could create proofs that are dated in the future. The RFC's answer is a nonce that the server chooses: "Without employing such a mechanism, a malicious party controlling the client (potentially including the end-user) can create DPoP proofs for use arbitrarily far in the future."
- **Replay across instances.** The `jti` check is strong, but the RFC admits that "it may not always be feasible in practice, e.g., when multiple servers behind a single endpoint have no shared state." If you run several gateway instances, either keep the lifetime of a proof short or share the `jti` store between them.
- **The proof does not cover the body.** The only parts of the request that a proof names are `htm` and `htu`. MCP sends every message as a POST to one address, because "The server MUST provide a single HTTP endpoint path". As a result, one proof fits any tool call. Someone who captures a token together with a fresh proof can send a different call with them, until the proof is too old or its `jti` has been seen. My advice: with MCP, treat the `jti` check as required, not as optional.

## Mutual TLS instead of DPoP

Mutual TLS binds the token to the client's certificate, instead of to a key carried in a header. The abstract of the RFC says: "OAuth authorization servers are provided a mechanism for binding access tokens to a client's mutual-TLS certificate, and OAuth protected resources are provided a method for ensuring that such an access token presented to it was issued to the client presenting the token." In a JWT, the binding is the thumbprint of the certificate. It is carried in the `x5t#S256` member of the same `cnf` claim.

Mutual TLS has a condition that DPoP does not have. The resource "must have advance knowledge that mutual TLS is to be used for some or all resource accesses". The reason is that the certificate is requested during the TLS handshake, before the resource has seen any token.

This is my advice on which one to use, and where:

| | DPoP | Mutual TLS |
| --- | --- | --- |
| Works at | HTTP headers | The TLS connection |
| Fits best | Agents that run anywhere, outside your network | Services inside your own infrastructure, where certificates already exist |
| Watch out for | Clock skew, `jti` storage, nonces | TLS ending before the gateway, for example at a load balancer: the gateway must still see the certificate |
| In this design | Agent → gateway (step 5) | MCP server → payments API (step 9d), if both run in your infrastructure |

## Where the key comes from: workload identity

DPoP leaves one question open: whose key is it? DPoP binds a token to whichever key asked for it, and the RFC states that "DPoP itself is not used for client authentication." The answer to who the agent is still comes from the way the agent authenticates to the authorization server, at step 3.

In the first post, the agent was a client that the authorization server knew, together with an entry in a registry. Its credential was whatever the client registration used. If that credential is a client secret in a configuration file, then it is a bearer credential as well, because whoever reads the file can use it.

The IETF has a working group that deals with giving software its own identity. It is called WIMSE, which stands for Workload Identity in Multi System Environments. Its architecture draft defines a [workload](/glossary/#workload) as "software executing for a specific purpose, potentially comprising one or more running instances." The same working group's AI Identity Management System (AIMS) draft places agents in that category, in a section titled "Agents are workloads": "An Agent is a workload that iteratively interacts with a Large Language Model (LLM) and a set of Tools, Services and Resources."

The WIMSE drafts give a workload three things:

- **A name.** "A Workload Identifier is a URI that uniquely identifies a workload within the context of a specific trust domain."
- **A credential with a key.** "The Workload Identity Token (WIT) is a JWT that represents the identity of a workload and binds a public key to that identity." There is also a certificate form, for mutual TLS.
- **A proof for each request.** The Workload Proof Token is "a mechanism for workloads to prove possession of the private key associated with a Workload Identity Token (WIT)". Between workloads, it plays the same role as a DPoP proof.

The AIMS draft also makes a point that connects all of this to the registry: "The lifecycle of an agent identifier is distinct from the lifecycle of the credentials bound to it. Credentials are short-lived and expire while the identifier persists."

Put together, the pieces fit like this. The registry from the first post holds the agent's name. The platform issues short-lived credentials for that name. The agent uses them to authenticate to the authorization server, in place of a stored secret. Its tokens are then bound either to the certificate that it presents over mutual TLS, or to a DPoP key that it guards as carefully as the credential.

In deployed systems today, this is mostly done with SPIFFE: "SPIFFE, the Secure Production Identity Framework for Everyone, is a set of open-source standards for securely identifying software systems in dynamic and heterogeneous environments." SPIFFE calls its "short lived cryptographic identity documents" SVIDs.

## Where the standards stop

- **MCP, as written, expects bearer tokens.** The authorization specification says that the "MCP client MUST use the Authorization request header field defined in OAuth 2.1 Section 5.1.1", and it shows the header as `Authorization: Bearer <access-token>`. It does not mention DPoP or mutual TLS. A DPoP-bound token is sent with the `DPoP` scheme instead. Using DPoP with MCP today is therefore an agreement between your agent, your authorization server and your gateway, and it goes beyond the letter of the specification. The WIMSE AIMS draft does recommend sender-constrained tokens for agents: "Access tokens may be sender-constrained to mitigate the risk of accidental token leakage or deliberate token theft, so that a token obtained by an attacker cannot be used without the corresponding key."
- **The WIMSE documents are drafts.** The architecture, identifier, credential and proof documents are working group drafts, and the AIMS draft is at its first revisions.
- **Whether the runtime deserves a key.** Binding a token to a key proves who holds the key. It does not prove that the software holding the key is the software you deployed. That second question is called attestation. The IETF's RATS architecture ([RFC 9334](https://www.rfc-editor.org/rfc/rfc9334.html), January 2023) describes it: "it is often useful for one end of a communication to know whether the other end is in an intended operating state." The WIMSE architecture notes that "A workload credential provisioning process may use attestation in addition to or instead of bootstrap credentials". However, these specifications do not say how a platform decides that an agent's runtime has earned its credential.

## When this is more than you need

Proof of possession adds a key to manage, a signature on every request, and state to keep at the gateway. My advice:

- **You may not need it** when tokens live for a few minutes, never leave one network, and pass through nothing that logs headers. Short lifetimes, which the MCP specification asks for, may be enough.
- **It earns its place** when the agent runs outside your network, when its traffic passes through proxies, logs or third-party tooling that you do not control, or when its tools move money or read sensitive data.

Whichever you choose, keep the private key out of the places where tokens leak: logs, files, environment variables and the agent's own context.

## Who proves what

| Step | Building block | What it proves | Standard | Status (November 2026) |
| --- | --- | --- | --- | --- |
| 2, 4 | Authorization server | Binds the token to the agent's key | DPoP, or mutual TLS | RFC 9449, September 2023; RFC 8705, February 2020 |
| 5 | Gateway (PEP) | The sender holds the key the token is bound to | DPoP | RFC 9449, September 2023 |
| 9a–9d | MCP server | Its exchanged token is bound to its own key | DPoP with Token Exchange | RFC 9449 and RFC 8693 |
| – | Agent runtime | Who the agent is, with a short-lived credential and key | WIMSE; SPIFFE in practice | WIMSE working group drafts; SPIFFE is open-source, outside the IETF |
| – | MCP | Sending a DPoP-bound token | MCP authorization | No mention; revision 2026-07-28 shows only the Bearer scheme |

## Where this leaves the design

The design now has four layers. Each one answers a question that the token cannot answer alone:

| Layer | The question | Answered by |
| --- | --- | --- |
| 1 | Is this specific call allowed? | The gateway and the PDP, on every call |
| 2 | Has anything changed since the token was issued? | Shared Signals, through the PDP |
| 3 | Who is acting for whom, after the first hop? | Token Exchange and the `act` claim |
| 4 | Is the one presenting the token the one it was issued to? | DPoP or mutual TLS |

At the end of the first post, the agent was a client identifier and an entry in a registry. It now also has a key that its tokens are bound to, and a credential that can expire without the agent losing its name.

## Sources

- [RFC 9449: OAuth 2.0 Demonstrating Proof of Possession (DPoP)](https://www.rfc-editor.org/rfc/rfc9449.html)
- [RFC 8705: OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens](https://www.rfc-editor.org/rfc/rfc8705.html)
- [RFC 6750: The OAuth 2.0 Authorization Framework: Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html)
- [RFC 8693: OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693.html)
- [RFC 9334: Remote ATtestation procedureS (RATS) Architecture](https://www.rfc-editor.org/rfc/rfc9334.html)
- [Model Context Protocol, Authorization, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Model Context Protocol, Authorization Security Considerations, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [Model Context Protocol, Streamable HTTP transport, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [IETF WIMSE working group documents](https://datatracker.ietf.org/wg/wimse/documents/)
- [WIMSE Architecture, draft-ietf-wimse-arch-09](https://datatracker.ietf.org/doc/draft-ietf-wimse-arch/)
- [Workload Identifier, draft-ietf-wimse-identifier-04](https://datatracker.ietf.org/doc/draft-ietf-wimse-identifier/)
- [WIMSE Workload Credentials, draft-ietf-wimse-workload-creds-03](https://datatracker.ietf.org/doc/draft-ietf-wimse-workload-creds/)
- [WIMSE Workload Proof Token, draft-ietf-wimse-wpt-02](https://datatracker.ietf.org/doc/draft-ietf-wimse-wpt/)
- [AI Identity Management System, draft-ietf-wimse-aims-01](https://datatracker.ietf.org/doc/draft-ietf-wimse-aims/)
- [SPIFFE overview](https://spiffe.io/docs/latest/spiffe-about/overview/)
