---
title: "Securing AI Agents, Layer by Layer - Part 3: Delegation"
linkTitle: "Delegation"
lastChecked: 2026-11-18   # when the facts and statuses were last verified against the sources
updates:
  - date: 2026-11-19
    note: "Rewritten to be easier to read. The facts, examples and sources are the same."
inShort:
  - "The MCP server must not pass on the token it received, and calling with its own credential hides whose request it is."
  - "OAuth Token Exchange issues a new token for the next API that still names the user, and its act claim records who acts for her."
  - "Inside a service, Transaction Tokens carry the context; across domains, identity chaining does the same job."
date: 2026-11-18T12:24:00Z
lastmod: 2026-11-19
draft: false
weight: 3
toc: true
aliases: ["/blogs/securing-ai-agents-part-3-delegation/"]
series: "Securing AI Agents, Layer by Layer"
tags: ["ai-agents", "authorization", "oauth", "mcp", "delegation"]
description: "The MCP server must call a payments API for Alice without passing her token on. OAuth Token Exchange issues a new token that records who acts for whom."
summary: "To run a tool, an MCP server often has to call another API. It is not allowed to pass on the token it received, and if it calls with its own credential, the next API no longer knows who the request is for. This post adds that next hop to the design. It shows how OAuth Token Exchange issues a new token for the next API, one that still names the user and records who is acting for her, and it then covers Transaction Tokens inside a service and chaining across domains."
---

To run a tool, an MCP server often has to call another API. It is not allowed to pass on the token it received, and if it calls with its own credential, the next API no longer knows who the request is for. This post adds that next hop to the design. It shows how OAuth Token Exchange issues a new token for the next API, one that still names the user and records who is acting for her, and it then covers Transaction Tokens inside a service and chaining across domains.

*This series builds one design, one layer at a time. [The first post](/posts/securing-ai-agents-part-1-building-blocks/) introduced the building blocks and followed one payment through them, and [the second](/posts/securing-ai-agents-part-2-shared-signals/) kept those checks informed after the token was issued. This post keeps the same example and the same step numbers. When I quote a specification, words such as MUST, SHOULD and MAY are the specification's own. When the advice is mine, I say so. The terms are explained in the [glossary](/glossary/).*

## The problem: the hop after step 9

In the first post, step 9 ended with the MCP server checking that Alice's token had been issued for it, and then running `transfer_funds`. But running that tool means calling something else. In this example, it is the company's payments API, the service that actually moves the money. The first post stopped at that point, and this one starts there.

The question is what the MCP server should present to the payments API. There are two shortcuts, and both are wrong.

**The first shortcut is to pass Alice's token on.** The MCP specification forbids it: "The MCP server MUST NOT pass through the token it received from the MCP client." The reason is the audience. Alice's token was issued for the MCP server, so a payments API that checks the audience will refuse it. A payments API that does not check is in a worse position, and the MCP security guidance names one of the costs: "The downstream Resource Server's logs may show requests that appear to come from a different source with a different identity, rather than the MCP server that is actually forwarding the tokens."

**The second shortcut is to use the MCP server's own credential.** In that case the payments API sees a single caller, the finance MCP server, which is a service that may move money for every customer. Alice has disappeared from the request. The payments API cannot apply her limits, and its records cannot show whose money it was or who asked for the payment. Every check passes, and the only party that still knows about Alice is the MCP server, which now holds the authority of everyone it serves.

The MCP specification points in the right direction: "If the MCP server makes requests to upstream APIs, it may act as an OAuth client to them. The access token used at the upstream API is a separate token, issued by the upstream authorization server." What it does not say is how to get a separate token that still names Alice. That is what this post adds.

## What the new token must say

The token for the payments API has to say three things:

- **For whom the request is made:** Alice, so that the payments API can apply her limits.
- **To whom the token is addressed:** the payments API, and only the payments API. This is the audience rule from the first post, applied again.
- **Who is acting:** the finance MCP server, on Alice's behalf, at the request of her agent.

The standard that issues such a token is OAuth 2.0 [Token Exchange](/glossary/#token-exchange) ([RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html), January 2020). According to its abstract, it "defines a protocol for an HTTP- and JSON-based Security Token Service (STS) by defining how to request and obtain security tokens from OAuth 2.0 authorization servers, including security tokens employing impersonation and delegation."

The last two words of that sentence, impersonation and delegation, are two different ways to use the standard, and a design has to choose between them. With impersonation, the RFC says, "A is B within the context of the rights authorized by the token". The MCP server would be indistinguishable from Alice. With delegation, "principal A still has its own identity separate from B, and it is explicitly understood that while B may have delegated some of its rights to A, any actions taken are being taken by A representing B." The RFC then adds a sentence that could have been written for this series: "In a sense, A is an agent for B."

This design uses delegation. My advice: when there are agents in the chain, keep every party visible. A token that hides who acted makes every later question harder to answer.

## The flow, after step 9

{{< diagram src="/images/posts/part3-delegation.svg" mobile="/images/posts/part3-delegation-mobile.svg" caption="The whole flow, from step 0. Highlighted: what this post adds." >}}

Steps 0 to 9 are the same as in the first post. The agent is on record and gets its token, the gateway holds the call, the PDP allows it, and the MCP server checks the audience of Alice's token. The new steps happen inside step 9, so they are numbered 9a to 9e.

In this section, the payments API trusts the same [authorization server](/glossary/#authorization-server) as the MCP server. [A later section](#across-domains-when-the-api-has-its-own-authorization-server) covers an API that does not.

The MCP server begins by sending a token exchange request to the authorization server (step 9a). The request presents two tokens and names a target. Alice's token is the subject token, the MCP server's own credential is the actor token, and the payments API is the target:

```http
POST /token HTTP/1.1
Host: idp.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&subject_token=<Alice's access token from step 4>
&subject_token_type=urn:ietf:params:oauth:token-type:access_token
&actor_token=<the MCP server's own token>
&actor_token_type=urn:ietf:params:oauth:token-type:jwt
&resource=https://payments.example.com/
&scope=payments:transfer
```

(The line breaks in the body are only there to make it readable; a real body is a single line.)

The `subject_token` parameter is required, and the RFC defines it as "A security token that represents the identity of the party on behalf of whom the request is being made." The `actor_token` parameter is optional, and the RFC defines it as "A security token that represents the identity of the acting party." The `resource` parameter is the same one that the agent used in step 2. Here it names the payments API.

The MCP server also authenticates as a client when it sends this request. The RFC explains why that matters: "Note that omitting client authentication allows for a compromised token to be leveraged via an STS into other tokens by anyone possessing the compromised token."

The authorization server now decides whether to issue the new token (step 9b). It makes two checks.

First, it validates Alice's token. The RFC requires this: "the authorization server MUST perform the appropriate validation procedures for the indicated token type". This is also the one moment in the chain when the authorization server is asked again, and it is the same authorization server that sent the signals in the second post. My advice: make the exchange fail for an account that has been disabled, so that a token issued before 10:01 cannot be used to open a new hop after it.

Second, it decides whether this MCP server may act for Alice at the payments API. The RFC leaves that decision to the authorization server's own policy. It notes that client authentication "allows for additional authorization checks by the STS as to which entities are permitted to impersonate or receive delegations from other entities". It also defines a claim, `may_act`, that a subject token can carry to state the answer in advance: "The "may_act" claim makes a statement that one party is authorized to become the actor and act on behalf of another party."

My advice: keep that policy as an explicit list. For each MCP server, write down which APIs it may exchange tokens for and with which scopes, and keep those scopes narrower than the scopes of the token it received. In addition, accept a subject token only from the server it was issued for, so that a token copied somewhere else cannot be exchanged by someone else.

If both checks pass, the authorization server returns a new token (step 9c). Its claims look like this:

```json
{
  "iss": "https://idp.example.com/",
  "aud": "https://payments.example.com/",
  "sub": "alice@example.com",
  "scope": "payments:transfer",
  "iat": 1794909600,
  "exp": 1794909900,
  "act": {
    "sub": "https://finance-mcp.example.com/",
    "act": {
      "sub": "finance-assistant"
    }
  }
}
```

The audience (`aud`) is now the payments API, and the subject (`sub`) is still Alice. The `act` claim records who is acting. The RFC describes it this way: "The "act" (actor) claim provides a means within a JWT to express that delegation has occurred and identify the acting party to whom authority has been delegated."

In this token, the current actor is the MCP server. The agent, which was the client of Alice's original token, is recorded inside it as a prior actor. Recording the agent is a choice made in this design. The RFC shows nested actors, but it leaves it to the authorization server to decide what to record.

The MCP server then calls the payments API with the new token (step 9d). The payments API checks that the token was issued for it, exactly as the MCP server did at step 9, and it applies Alice's own limits.

Finally, the payments API returns the result to the MCP server (step 9e). From there, the flow of the first post continues: the result goes back to the agent at step 10, and the agent tells Alice at step 11.

## Reading the `act` claim

A chain of actors is written by nesting one `act` claim inside another. The RFC explains how to read it: "The outermost "act" claim represents the current actor while nested "act" claims represent prior actors. The least recent actor is the most deeply nested."

The RFC then gives a rule that is easy to miss, and that matters a great deal for agents: "For the purpose of applying access control policy, the consumer of a token MUST only consider the token's top-level claims and the party identified as the current actor by the "act" claim. Prior actors identified by any nested "act" claims are informational only and are not to be considered in access control decisions."

Apply that rule to step 9d. The payments API may base its decision on Alice and on the MCP server, but not on the agent. A rule such as "the finance assistant may never move more than 1,000 EUR" cannot be enforced at the payments API with this token, because at that point the agent is only a prior actor.

This is not a gap in the design, as long as each rule is enforced in a place where its subject is visible. At the gateway, the agent is the client. Rules about the agent therefore belong to the PDP at step 7, where the first post already put the agent into `context.agent`. The nested `act` claim is still useful further down, because it lets the payments API's records show the whole chain, from Alice to her agent to the MCP server.

My advice: decide about the agent at the gateway, decide about the user at every API, and use the chain of actors for the record.

## Inside the payments service: Transaction Tokens

The payments API is rarely the end of the chain. Behind it there may be a fraud check and a ledger service, each running a part of the same payment. If the access token were passed from one of these services to the next, the problem from the first section would come back, one level further down.

The IETF OAuth working group has a draft for this situation, called [Transaction Tokens](/glossary/#transaction-tokens). Its abstract says: "Transaction Tokens (Txn-Tokens) are designed to maintain and propagate user identity, workload identity and authorization context throughout the Call Chain within a trusted domain". They do this "in short-lived, signed JWTs that are bound to specific transactions and propagated throughout the Call Chain within a Trust Domain."

In the draft's terms, this is how they work:

- **There is one issuer per Trust Domain.** It is the Transaction Token Service (TTS), which the draft defines as "A special service within the Trust Domain that issues Txn-Tokens to requesting workloads. Each Trust Domain using Txn-Tokens MUST have exactly one logical TTS." The payments API asks the TTS for a Txn-Token when the request arrives, and that request reuses Token Exchange: "If the transaction token request is made via HTTP to a remote server, it MUST use [RFC8693]".
- **The context travels with the call.** The `tctx` claim is "A JSON object that contains values that remain immutable throughout the Call Chain". In this example it would hold the amount, the currency and the payee, so the ledger sees the same 800 EUR that the payments API was asked to move.
- **The token stays inside the Trust Domain.** "A Txn-Token MUST NOT be accepted outside the Trust Domain identified by the aud claim."
- **The token is short-lived.** "Txn-Tokens are expected to be short-lived (on the order of minutes or less)".
- **The token does not contain the access token.** "When creating Txn-Tokens, the Txn-Token MUST NOT contain the access token presented to the external endpoint." It also travels in its own HTTP header, "Txn-Token", because "the standard HTTP Authorization header MUST NOT be used".

Token Exchange and Transaction Tokens do not compete, because they answer different questions. Token Exchange gets a token for another audience. Transaction Tokens carry the context of one request through the services behind a single entry point. In this design, the MCP server uses Token Exchange to reach the payments API, and the payments API uses Transaction Tokens inside its own Trust Domain.

## Across domains: when the API has its own authorization server

So far, the payments API has trusted the same authorization server as the MCP server. Now suppose that it belongs to the bank, and that the bank runs its own authorization server. A token from your authorization server means nothing there.

The OAuth working group's Identity and Authorization Chaining specification covers this case. Its abstract says: "This specification describes a mechanism for preserving identity and authorization information across trust domains that use the OAuth 2.0 Framework. A JSON Web Token (JWT) authorization grant, obtained through an intra-domain OAuth 2.0 Token Exchange, facilitates the cross-domain acquisition of an access token."

In practice, step 9a becomes two requests:

1. The MCP server exchanges Alice's token at its own authorization server, as in step 9a. This time, however, it asks for a JWT authorization grant that is meant for the bank's authorization server.
2. The MCP server presents that grant to the bank's authorization server, using the JWT grant type from [RFC 7523](https://www.rfc-editor.org/rfc/rfc7523.html) (May 2015), and receives an access token for the bank's API.

This only works if the two domains already trust each other. The specification says: "This requires a trust relationship between the authorization servers in trust domain A and trust domain B." That trust is set up by configuration, usually as keys that one domain accepts from the other.

The same two building blocks also appear in MCP itself, on the other side of the agent. The Enterprise-Managed Authorization extension lets the agent get its token for an MCP server through the organization's identity provider. The client first obtains an Identity Assertion JWT Authorization Grant (ID-JAG) with "a Token Exchange (RFC 8693) request". It then exchanges the ID-JAG at the MCP server's authorization server, "using the urn:ietf:params:oauth:grant-type:jwt-bearer grant". The ID-JAG itself is defined in an OAuth working group draft.

## Where the standards stop

Token Exchange has been an RFC since 2020. Around it, however, several things are still left for you to decide:

- **How the agent is named in the chain.** The `act` claim can hold any claims that identify an actor, and no standard says what identifies an AI agent. This is the registry gap from the first post, showing up again. The WIMSE working group's AI Identity Management System draft, which is at an early stage (-01), states the requirement plainly: "Agents MUST be uniquely identified in order to support authentication, authorization, auditing, and delegation."
- **Who may exchange what.** The RFC leaves the exchange policy to the authorization server. The `may_act` claim lets a subject token name who may act for its subject, but who puts the claim there, and when, depends on your deployment.
- **How long a chain may grow.** Nothing limits how deeply `act` claims can be nested, and nothing says when a service should refuse a chain that is too long.
- **Vendor flows.** Some products have their own delegation flow. One example is Microsoft's on-behalf-of flow, which "describes the scenario of a web API using an identity other than its own to call another web API". It is not an RFC 8693 request, because it uses the JWT bearer grant type with `requested_token_use=on_behalf_of`. If your platform offers a flow like this, check what its tokens record about the actor.

## When this is more than you need

Token Exchange adds a request to the authorization server for every new token, and that is not always worth it. My advice:

- **You may not need it** when the API behind the MCP server does not act on a specific user's data, such as exchange rates or public reference data. The MCP server's own credential is then the honest one.
- **You may not need it** when the MCP server is the system of record itself, and nothing sits behind it.
- **It earns its place** when the API moves money or reads data that belongs to one user, applies that user's own limits, or must record who asked. A payment is all three.

To keep the cost down, the MCP server can reuse an exchanged token until it expires, instead of making an exchange for every call. It should reuse the token only for calls that arrive with the same token from the agent. A token cached per user alone would name the wrong agent in `act` as soon as one user has two agents.

## Who acts for whom

| Hop | Who presents what | Standard | Status (November 2026) |
| --- | --- | --- | --- |
| 5–9 | The agent presents Alice's token to the gateway and the MCP server | MCP authorization, OAuth 2.1 | MCP revision 2026-07-28; OAuth 2.1 is a draft |
| 9a–9c | The MCP server exchanges Alice's token for a new one | OAuth 2.0 Token Exchange | RFC 8693, January 2020 |
| 9d | The MCP server presents the new token, with `act`, to the payments API | OAuth 2.0 Token Exchange | RFC 8693, January 2020 |
| Behind 9d | Services inside the payments domain pass a Txn-Token | Transaction Tokens | Working Group Draft (-11), waiting for the shepherd's write-up |
| Across domains | The MCP server presents a JWT grant to the bank's authorization server | Identity and Authorization Chaining, RFC 7523 | Approved draft (-17) in the RFC Editor queue; RFC 7523, May 2015 |

## What this design still trusts

The chain now records who is acting for whom at every hop. However, every token in it, both Alice's token and the exchanged one, is still a [bearer token](/glossary/#bearer-token), which means that whoever holds it can use it. If the token from step 9c is copied out of the MCP server's logs, anyone can present it to the payments API, and the chain of actors will still say all the right things.

The next layer binds each token to a key that only its rightful holder has. That is the subject of [the next post](/posts/securing-ai-agents-part-4-proof-of-possession/).

## Sources

- [RFC 8693: OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693.html)
- [RFC 7523: JSON Web Token (JWT) Profile for OAuth 2.0 Client Authentication and Authorization Grants](https://www.rfc-editor.org/rfc/rfc7523.html)
- [Transaction Tokens, draft-ietf-oauth-transaction-tokens-11](https://datatracker.ietf.org/doc/draft-ietf-oauth-transaction-tokens/)
- [OAuth Identity and Authorization Chaining Across Domains, draft-ietf-oauth-identity-chaining-17](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-chaining/)
- [Identity Assertion JWT Authorization Grant, draft-ietf-oauth-identity-assertion-authz-grant](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/)
- [Model Context Protocol, Authorization Security Considerations, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [Model Context Protocol, Security Best Practices, revision 2026-07-28](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)
- [Model Context Protocol, Enterprise-Managed Authorization extension](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization)
- [AI Identity Management System, draft-ietf-wimse-aims-01](https://datatracker.ietf.org/doc/draft-ietf-wimse-aims/)
- [The OAuth 2.1 Authorization Framework, draft-ietf-oauth-v2-1](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- [Vendor flow: Microsoft identity platform and the OAuth 2.0 On-Behalf-Of flow](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
