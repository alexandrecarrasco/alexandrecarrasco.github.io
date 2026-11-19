---
title: "Securing AI Agents, Layer by Layer - Part 1: The Building Blocks"
linkTitle: "The Building Blocks"
lastChecked: 2026-11-18   # when the facts and statuses were last verified against the sources
updates:
  - date: 2026-11-18
    note: "Added why the MCP server must only be reachable through the gateway (step 5)."
  - date: 2026-11-19
    note: "Rewritten to be easier to read. The facts, examples and sources are the same."
inShort:
  - "An AI agent picks its tool and arguments at runtime, so the one that chooses the action cannot be the one that decides whether it is allowed."
  - "A token is fixed before the call. A gateway, the policy enforcement point, asks a policy decision point about every tool call, using the AuthZEN API."
  - "Two pieces have no open standard yet: the agent registry, and which token a gateway presents when it fronts several MCP servers."
date: 2026-11-17
lastmod: 2026-11-19
draft: false
weight: 1
toc: true
aliases: ["/blogs/securing-ai-agents-part-1-building-blocks/"]
series: "Securing AI Agents, Layer by Layer"
tags: ["ai-agents", "authorization", "oauth", "mcp"]
description: "One AI agent payment, followed step by step through the blocks that keep the agent in check: agent registry, authorization server, gateway, PDP and MCP server."
summary: "An AI agent decides for itself, while it runs, which tool to call and with which arguments. That is what makes it useful, and it is also why something else has to check what it does. This post follows one payment from start to finish and shows, step by step, which component checks what."
---

An AI agent decides for itself, while it runs, which tool to call and with which arguments. That is what makes it useful, and it is also why something else has to check what it does. This post follows one payment from start to finish and shows, step by step, which component checks what.

*This is the first post of a series that builds one design, one layer at a time. It introduces the building blocks and follows a single request through them. When I quote a specification, words such as MUST, SHOULD and MAY are the specification's own. When the advice is mine, I say so. The terms are explained in the [glossary](/glossary/).*

## The problem

Alice asks her finance assistant, which is an AI agent, to pay invoice 4471. The agent reads the invoice, decides that the tool it needs is `transfer_funds`, fills in the amount and the payee, and calls the tool.

Nobody programmed that sequence in advance. The agent chose the tool and its arguments while it was running, based on what Alice asked and on what it read in the invoice. If the invoice had contained hidden instructions, the agent would have read those as well.

This leads to the idea behind everything else in this post: the component that chooses an action cannot be the one that decides whether the action is allowed. Something outside the agent has to make that decision.

## The building blocks

Seven parties take part in the payment. Two of them are Alice and her agent. The other five are the building blocks that keep the agent in check, and the rest of this post introduces them one at a time. For now, it is enough to know the question each one answers:

| Party | The question it answers |
| --- | --- |
| **User** (Alice) | What do I want done? |
| **Agent** (the MCP client) | Which tool, with which arguments? |
| **Agent registry** | Does this agent exist, and who is accountable for it? |
| **Authorization server** | May this agent hold a token, for this user and this server? |
| **Gateway**, the policy enforcement point (PEP) | Has this call been checked before it goes through? |
| **Policy decision point** (PDP) | Is this specific call allowed? |
| **MCP server** | Was this token issued for me? |

## The flow, start to finish

{{< diagram src="/images/posts/part1-flow.svg" mobile="/images/posts/part1-flow-mobile.svg" >}}

The flow has three phases. Step 0 happens once, before any request is made. Steps 1 to 4 give the agent a token. Steps 5 to 11 are repeated for every tool call, and this is where each call is checked. The sections below go through the steps in order.

## Before any request (step 0)

Before the agent can do anything, it has to be known in two places (step 0).

The first is the **[agent registry](/glossary/#agent-registry)**, an inventory of the organization's agents. For each agent, it records what the agent is, who is accountable for it, and whether it is active. In this example, the entry says that the finance assistant is owned by the finance team and is active.

The second is the **[authorization server](/glossary/#authorization-server)**, the service that issues tokens. It knows the agent as a client that it may issue tokens to.

The registry answers one question only: should this agent exist at all? It does not decide what the agent may do on a particular call. It knows that the finance assistant exists, but not whether this payment is acceptable. No open standard defines an agent registry yet, and [a later section](#the-agent-registry) describes what exists today.

## Getting a token (steps 1 to 4)

Everything starts when Alice asks the agent to pay invoice 4471 (step 1).

To call the finance tools on Alice's behalf, the agent needs an access token, so it asks the authorization server for one (step 2). The first time this happens, Alice signs in and consents; the MCP authorization specification describes that exchange. In its request, the agent has to name the server it intends to call. It does this with the `resource` parameter ([RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html)), and the MCP specification makes the parameter mandatory: it "MUST be included in both authorization requests and token requests" and "MUST identify the MCP server that the client intends to use the token with".

Before it issues anything, the authorization server checks its own record of the agent (step 3). Is this a client it knows, and is that client still enabled? Here the answer is yes, because this design registers the agent with the authorization server in advance, which the MCP specification calls pre-registration. An agent that fails this check receives an error and no token. OAuth has an error for exactly this case, `invalid_client`, which covers an "unknown client" ([RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html), section 5.2).

The MCP specification also describes a second way to identify clients, called Client ID Metadata Documents. With these, the client identifier is a URL that the client hosts, and the authorization server has no record of the client beforehand. In my reading, the check at step 3 then becomes a policy about which identifiers the authorization server is willing to trust.

Finally, the authorization server returns an access token (step 4). The token's audience, which is the service the token was issued for, is the finance MCP server and only that server.

It helps to be clear about what this token can and cannot do, because the rest of the design depends on it. A token is issued once and then used for many calls. In effect it says "this agent, acting for Alice, may call the finance tools". It was created before the agent chose this tool and these arguments, and it cannot look anything up, such as whether Alice has paid this payee before.

OAuth does have a way to ask for finer-grained access, called Rich Authorization Requests ([RFC 9396](https://www.rfc-editor.org/rfc/rfc9396.html)), and the RFC's own example is a credit transfer with an amount. Even so, whatever is granted is fixed when the token is issued, not when the call is made. That is why the next phase checks every call.

## Calling the tool (steps 5 to 11)

The agent now calls the tool. It sends a `tools/call` request for `transfer_funds`, together with the token, to the **gateway** (step 5). The gateway is an intermediary that sits in front of the MCP server, and every tool call passes through it.

That last point has to be guaranteed, not assumed. The agent's token is valid at the MCP server, and the server's own check, at step 9, only looks at who the token was issued for. A call that reached the server without passing through the gateway would skip the checks at steps 6 and 7 and still run. My advice: make sure the MCP server cannot be reached any other way. Let it accept connections only from the gateway, through network rules or a credential that only the gateway holds.

In this design, the gateway is the **[policy enforcement point (PEP)](/glossary/#pep)**. A PEP holds a request, asks another component for a decision, and then either lets the request through or stops it. It enforces decisions, but it does not make them. The term comes from NIST SP 800-207, *Zero Trust Architecture* (2020), which defines the PEP as the component "responsible for enabling, monitoring, and eventually terminating connections between a subject and an enterprise resource". NIST also notes that a PEP may be a "gateway component in front of resource that controls access".

The MCP specification itself does not define a gateway. A gateway is an industry pattern, and the document that gives it a name and rules is [COAZ-MCP](/glossary/#coaz-mcp), a binding written by the OpenID [AuthZEN](/glossary/#authzen) working group that is still a draft. COAZ-MCP defines the MCP gateway as an "optional intermediary between an MCP client and one or more MCP servers", and it says that "a gateway MAY act as the PEP on behalf of the MCP server". When there is no gateway, the MCP server has to enforce on its own.

The gateway now asks for a decision (step 6). It sends a question to the **policy decision point (PDP)**, the component that holds the policy: may Alice's agent do this? The question has a standard shape, defined by the OpenID [AuthZEN Authorization API 1.0](https://openid.net/specs/authorization-api-1_0.html), which has been a Final specification since January 2026:

```json
{
  "subject":  { "type": "identity", "id": "alice@example.com" },
  "action":   { "name": "transfer_funds" },
  "resource": { "type": "account", "id": "acct-ops-001" },
  "context": {
    "agent": "finance-assistant",
    "invoice": "4471",
    "amount": 800,
    "currency": "EUR",
    "payee": "acct-9920"
  }
}
```

The request has four parts: `subject`, `action` and `resource` are required, and `context` is optional. COAZ-MCP describes how an MCP tool call becomes such a request. The user comes from the token and becomes the `subject`, and the agent's client identifier goes into `context.agent`. By default, the action is `tools/call` and the resource is the tool's name, but a tool can declare its own mapping, and this example assumes that it does.

Because the request is built from what the token says, the gateway has to validate the token first. COAZ-MCP requires it: "The PEP MUST verify the token signature, issuer, audience, and expiration".

The PDP then evaluates the request against its policy (step 7). As an example, take this policy, which is mine: *an agent may pay up to 1,000 EUR to payees the user has paid before; anything else is refused.* The request does not say whether Alice has paid `acct-9920` before, so the PDP looks that up in its own data. She has, and 800 EUR is under the limit, so the PDP answers with `"decision": true`. Every AuthZEN answer contains this boolean `decision`.

Notice that the PDP never sees the traffic. It only answers the question that the PEP asks. The AuthZEN specification describes the same two roles, calling a service that implements the API "a Policy Decision Point, or PDP" and its client "a Policy Enforcement Point, or PEP". NIST SP 800-207 uses the same split.

Since the decision is `true`, the gateway forwards the call, with the token, to the **MCP server** (step 8). The token is still the right one for this hop, because in this design the gateway sits at the MCP server's own address, and the token was issued for that address. No standard covers this hop, and [a later section](#the-gateway-and-the-token) explains what changes when one gateway fronts several servers.

Before it runs anything, the MCP server makes one last check of its own (step 9). In OAuth terms the MCP server is a resource server, and the MCP specification is direct about what it must do: "MCP servers MUST validate that access tokens were issued specifically for them as the intended audience", and "MCP servers MUST NOT accept or transit any other tokens". The token from step 4 was issued for this server, so the server runs `transfer_funds`.

The result then goes back to the agent through the gateway (step 10), and the agent tells Alice that the invoice is paid (step 11).

## The same flow, a different answer

Now change one thing. The next invoice asks for 25,000 EUR, to a payee Alice has never paid.

The agent still holds the token from step 4, so it goes straight to step 5 and sends the call to the gateway. The gateway asks the PDP, exactly as before. This time the answer at step 7 is different: the amount is over the limit and the payee is new, so the PDP returns `"decision": false`.

The gateway stops the call there. COAZ-MCP says that on a deny, "the PEP MUST return an error response with code `-32001`". (It adds that implementations MAY instead return the denial as a tool result with `isError` set to `true`; this post uses the error.) Steps 8 to 11 never happen, and the MCP server never sees the request.

The token was the same as for the first invoice. The only thing that changed was the arguments of the call, and the per-call check was the only place where those arguments could be seen.

A refusal does not have to be the end. A design can ask Alice to confirm the payment instead, but that is a separate mechanism and outside this post.

The gateway is just as strict when something breaks. COAZ-MCP states that "the PEP MUST fail closed: a mapping error, a denial, or a PDP communication failure all result in the message being refused". In the same way, a request whose method has no mapping "MUST be denied", so that "methods introduced by future MCP versions or extensions fail closed rather than bypassing authorization". In practice, if the gateway cannot reach the PDP, the call does not go through.

That strictness has a price: when the PDP is down, every tool behind the gateway stops. NIST SP 800-207 names the same risk. In its model, the PDP is made of two parts, the policy engine and the policy administrator (PE/PA), and it warns: "If an attacker disrupts or denies access to the PEP(s) or PE/PA (i.e., DoS attack or route hijack), it can adversely impact enterprise operations." Its answer is enforcement that is "replicated in several locations". My advice: treat the PDP as part of the request path, run it close to the gateway, and plan its availability as carefully as you plan the gateway's. Keeping it close also keeps the extra request on every call short.

## Where the standards stop

Two parts of this flow are not covered by any open standard today. They work, but you build them from product features and your own choices.

### The agent registry

There is no open, cross-vendor standard for an agent registry. This is what exists today:

- **The need is recognized.** NIST's National Cybersecurity Center of Excellence published a concept paper in February 2026 for a planned project on agent identity and authorization. The paper is still a draft. It describes the goal as ensuring "that agents are known, trusted, and properly governed", and it names SCIM as "a potential way to create, update and revoke agent identities across systems".
- **The advice is consistent.** The OpenID Foundation's whitepaper *Identity Management for Agentic AI* (October 2025) tells enterprises to begin "treating agents as first-class citizens within their IAM infrastructure", and it warns that "agent identity fragmentation should be avoided".
- **Products already ship it.** Large vendors now offer agent registries: inventories or catalogs of an organization's agents, with metadata, discovery, and ownership or approval workflows. Each vendor has its own design, and the sources below list two of them.
- **Proposals exist, but none is adopted.** Individual Internet-Drafts at the IETF cover parts of the problem. The Agent Registry (AREG) draft is about publishing and discovering agent definitions, and the Agent Name Service (ANS) draft is about binding an agent's endpoint to the holder of its domain. Both are individual drafts, which means that no working group has adopted them.

Nothing standard connects the registry to the authorization server either. In at least one major platform they are separate products, where one holds the inventory and the other holds the agent's identity. My advice: whatever you use, check that disabling an agent in the registry also makes it fail the check at step 3, and that every agent has a named owner.

Two other things have a similar name and should not be confused with an agent registry. **The MCP Registry** is the official catalog of publicly accessible MCP servers. It lists servers, not your agents, and it is in preview. **OAuth client registration** is how an agent becomes a client that the authorization server knows. It settles the agent's client identifier, but it does not track ownership or lifecycle.

### The gateway and the token

The MCP specification mentions gateways as intermediaries that may route, inspect or cache messages, and it has a few rules for them, but it does not define one. COAZ-MCP, for its part, does not say which token a gateway presents to the server behind it.

What the MCP documents are clear about is the audience rule. The security guidance puts it this way: "MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server."

Two cases follow from that rule. This is my reading, not text from either document:

- **The gateway sits at the MCP server's own address**, as in this post. The agent's token was issued for that address, so the gateway can pass it on to the server, and the check at step 9 passes.
- **One gateway fronts several MCP servers under its own address.** The agent's token is then issued for the gateway, and the servers behind it must refuse it. The gateway needs a token of its own for each server. The MCP specification has a similar rule for an MCP server that calls an upstream API: "The MCP server MUST NOT pass through the token it received from the MCP client."

## When this is more than you need

Everything described above has a cost: one more component to keep running, and one more request on every call. That cost is not always worth paying. My advice:

- **You may not need a PDP** when an agent calls one service that already enforces fine-grained rules for the user on its own, such as a payment API with its own limits. The audience check at step 9 and that service's own rules may be enough.
- **A PDP earns its place** when the decision depends on the arguments of the call and the tool cannot check them itself, when several MCP servers must follow the same policy, or when you need one record of every decision, refusals included.

Either way, you still need the agent registry and a token issued for the right server.

## Who decides what

| Step | Building block | The question it answers | Standard | Status (November 2026) |
| --- | --- | --- | --- | --- |
| 0 | Agent registry | Does this agent exist, and who owns it? | None yet | No standard; products, plus guidance from NIST NCCoE and the OpenID Foundation |
| 2–4 | Authorization server | May the agent hold a token, for this user and this server? | OAuth 2.1, MCP authorization | OAuth 2.1 is a draft (-17, October 2026); MCP revision 2026-07-28 |
| 5, 8 | Gateway (PEP) | Has this call been checked before it goes through? | COAZ-MCP, NIST SP 800-207 | COAZ-MCP is a Working Group Draft (Draft 1); NIST SP 800-207 was published in 2020 |
| 6–7 | PDP | Is this specific call allowed? | AuthZEN Authorization API 1.0 | Final, January 2026 |
| 9 | MCP server | Was this token issued for me? | MCP authorization | Revision 2026-07-28 |

## What this design cannot see yet

Every check in this post happens at the moment a call is made. Now suppose that one minute after step 4, Alice's account is disabled, or her laptop is reported stolen. The token is still valid. The registry may not know, and the PDP will only find out if someone tells it.

The next layer closes that gap. It gives the authorization server a way to tell the other building blocks, as it happens, that something has changed. There is a standard for this, the OpenID [Shared Signals Framework](/glossary/#ssf), and it is the subject of [the next post](/posts/securing-ai-agents-part-2-shared-signals/).

## Sources

- [NIST SP 800-207: Zero Trust Architecture (August 2020)](https://csrc.nist.gov/pubs/sp/800/207/final)
- [OpenID AuthZEN Authorization API 1.0 (Final)](https://openid.net/specs/authorization-api-1_0.html)
- [COAZ-MCP: COAZ Binding for the Model Context Protocol, Draft 1](https://openid.github.io/authzen/authzen-coaz-mcp-binding-1_0.html)
- [OpenID AuthZEN working group specifications](https://openid.net/wg/authzen/specifications/)
- [Model Context Protocol, Authorization, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Model Context Protocol, Client Registration, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)
- [Model Context Protocol, Authorization Security Considerations, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [Model Context Protocol, Streamable HTTP transport, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Model Context Protocol, Caching, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
- [Model Context Protocol, Security Best Practices, revision 2026-07-28](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)
- [The OAuth 2.1 Authorization Framework, draft-ietf-oauth-v2-1](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- [RFC 6749: The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)
- [RFC 9396: OAuth 2.0 Rich Authorization Requests](https://www.rfc-editor.org/rfc/rfc9396.html)
- [NIST NCCoE: Accelerating the Adoption of Software and AI Agent Identity and Authorization, concept paper (draft, February 2026)](https://www.nccoe.nist.gov/sites/default/files/2026-02/accelerating-the-adoption-of-software-and-ai-agent-identity-and-authorization-concept-paper.pdf)
- [OpenID Foundation: Identity Management for Agentic AI (October 2025)](https://openid.net/new-whitepaper-tackles-ai-agent-identity-challenges/), and [its full text on arXiv](https://arxiv.org/abs/2510.25819)
- [The MCP Registry (preview)](https://modelcontextprotocol.io/registry/about)
- [Agent registry example: Microsoft Agent 365](https://learn.microsoft.com/microsoft-agent-365/admin/agent-registry-overview), and [how it relates to Microsoft Entra Agent ID](https://learn.microsoft.com/entra/agent-id/agent-registry-convergence)
- [Agent registry example: AWS Agent Registry](https://aws.amazon.com/about-aws/whats-new/2026/08/aws-agent-registry-generally-available/)
- [Agent Registry (AREG), draft-schemacommons-areg (individual Internet-Draft)](https://datatracker.ietf.org/doc/draft-schemacommons-areg/)
- [Agent Name Service v2 (ANS), draft-narajala-courtney-ansv2 (individual Internet-Draft)](https://datatracker.ietf.org/doc/draft-narajala-courtney-ansv2/)
- [OpenID Shared Signals working group specifications](https://openid.net/wg/sharedsignals/specifications/)
