---
title: "Securing AI Agents, Layer by Layer - Part 2: Shared Signals"
linkTitle: "Shared Signals"
lastChecked: 2026-11-18   # when the facts and statuses were last verified against the sources
updates:
  - date: 2026-11-18
    note: "New closing section that leads to Part 3, and a diagram of the whole flow."
  - date: 2026-11-19
    note: "Rewritten to be easier to read. The facts, examples and sources are the same."
inShort:
  - "A token stays valid after the user's account is disabled, and every check from Part 1 still passes."
  - "The OpenID Shared Signals Framework lets the authorization server tell the rest of the design as it happens; here a signal receiver passes it to the PDP."
  - "Signals are fast but not instant, silence is ambiguous, and no standard yet names an AI agent as the subject of a signal."
date: 2026-11-17
lastmod: 2026-11-19
draft: false
weight: 2
toc: true
aliases: ["/blogs/securing-ai-agents-part-2-shared-signals/"]
series: "Securing AI Agents, Layer by Layer"
tags: ["ai-agents", "authorization", "shared-signals"]
description: "An agent's token stays valid after the user's account is disabled. The OpenID Shared Signals Framework tells the design about changes as they happen."
summary: "The design from the first post checks every tool call. What it cannot do is notice when something changes after the token was issued, such as the user's account being disabled. This post adds one building block and one path, so that the authorization server can tell the rest of the design about a change as it happens. The standard for this is the OpenID Shared Signals Framework."
---

The design from the first post checks every tool call. What it cannot do is notice when something changes after the token was issued, such as the user's account being disabled. This post adds one building block and one path, so that the authorization server can tell the rest of the design about a change as it happens. The standard for this is the OpenID Shared Signals Framework.

*This series builds one design, one layer at a time. [The first post](/posts/securing-ai-agents-part-1-building-blocks/) introduced the building blocks and followed one payment through them. This post keeps the same example and the same step numbers. When I quote a specification, words such as MUST, SHOULD and MAY are the specification's own. When the advice is mine, I say so. The terms are explained in the [glossary](/glossary/).*

## The gap, in two minutes

In the first post, Alice's finance assistant received a token at step 4 and used it to pay an invoice of 800 EUR. To see the gap, put times on what happens next:

- **10:00.** The [authorization server](/glossary/#authorization-server) issues the token (step 4).
- **10:01.** The security team sees signs that Alice's account has been taken over, and disables it at the identity provider. In this design, the identity provider is also the authorization server.
- **10:02.** The agent, which is still running, calls `transfer_funds` for another 800 EUR, to a payee Alice has paid before.

Now follow the 10:02 call through the checks from the first post. The agent already holds a token, so the authorization server is not asked again. The gateway, which is the [policy enforcement point (PEP)](/glossary/#pep), holds the call and asks the [policy decision point (PDP)](/glossary/#pdp). The PDP sees a payment of 800 EUR to a known payee and answers `true`. The MCP server sees a token that was issued for it and runs the tool.

Every check passed, and yet the payment was made for an account that had been disabled a minute earlier. Nothing was broken. The problem is that nobody told the components that do the checking.

Short token lifetimes make this window smaller, but they do not close it. A token that lives for five minutes is still good for five minutes.

OAuth has an older answer to this problem, called token introspection ([RFC 7662](https://www.rfc-editor.org/rfc/rfc7662.html)). With introspection, whoever receives a token asks the authorization server whether the token is still `active`. This helps, but it has three limits. It adds a request to the authorization server on every call. What `active` covers depends on the product, because in the RFC's words it "will vary depending on the implementation of the authorization server". And it only answers about the token, not about a stolen laptop or a change in risk.

The OpenID Foundation's whitepaper on agent identity states the problem plainly: "With traditional OAuth 2.0, revoking a bearer token can be challenging." The same passage names a way forward: "The OpenID Foundation's Shared Signals Framework defines a protocol for communicating security events, allowing for the near-real-time propagation of revocations."

## What Shared Signals is

The [Shared Signals Framework](/glossary/#ssf) (SSF) is a standard way for one system to tell another that something has changed. In the specification's words, it "enables sharing of signals and events between cooperating peers".

The framework defines two roles:

- The **Transmitter** knows that something has changed and sends an event. In this design, the Transmitter is the authorization server.
- The **Receiver** wants to know about changes, and acts on what it hears.

The two are connected by an event stream, which the specification describes as "an abstraction for how events are communicated from a Transmitter to a Receiver". It is the Receiver that sets the stream up: "An Event Receiver creates a stream by making an HTTP POST request to the Configuration Endpoint." The Receiver finds that endpoint in a document that the Transmitter publishes at `/.well-known/ssf-configuration`.

Each event travels as a Security Event Token ([RFC 8417](https://www.rfc-editor.org/rfc/rfc8417.html)). This is a JSON Web Token that carries the event, and the Transmitter can sign it so that the Receiver can check where it came from. In this design, events are signed. An event can be delivered in two ways: by **push**, where the Transmitter sends each event to the Receiver ([RFC 8935](https://www.rfc-editor.org/rfc/rfc8935.html)), or by **poll**, where the Receiver fetches the events ([RFC 8936](https://www.rfc-editor.org/rfc/rfc8936.html)).

Three specifications work together here, and all three became OpenID Final Specifications in September 2025:

- **SSF 1.0** is the framework itself: streams, delivery, how a subject is named, and how a stream is verified. Its own two events are about the stream: `verification` and `stream-updated`.
- **CAEP 1.0** (Continuous Access Evaluation Profile) defines events about sessions and access: `session-revoked`, `credential-change`, `device-compliance-change`, `risk-level-change`, `token-claims-change`, `assurance-level-change`, `session-established` and `session-presented`.
- **RISC 1.0** (Risk Incident Sharing and Coordination) defines events about accounts: `account-disabled`, `account-enabled`, `account-purged`, `credential-compromise`, `identifier-changed`, and others.

The event names are the specifications' own.

## What a signal looks like

When Alice's account is disabled at 10:01, the result is a RISC `account-disabled` event. The specification defines this event in one sentence: "Account Disabled signals that the account identified by the subject has been disabled." The event below follows the shape of the specification's own example:

```json
{
  "iss": "https://idp.example.com/",
  "jti": "756E69717565206964656E746966696572",
  "iat": 1794909660,
  "aud": "https://signals.example.com/receiver",
  "sub_id": {
    "format": "email",
    "email": "alice@example.com"
  },
  "events": {
    "https://schemas.openid.net/secevent/risc/event-type/account-disabled": {
      "reason": "hijacking"
    }
  }
}
```

The event can be read claim by claim: who is saying it (`iss`), to whom (`aud`), when (`iat`), about whom (`sub_id`), and what happened (`events`). The `jti` claim is the token's unique identifier. SSF requires the subject to be present: "A top-level claim named `sub_id` MUST be used to describe the primary subject of the event." The `reason` is optional, and RISC allows two values for it, `hijacking` and `bulk-account`.

Two things about this event are worth noticing.

**The subject has to match.** The event names Alice by her email address. The decision request in the first post also named her as `alice@example.com`. If the two sides identified the same person in different ways, the signal would arrive and match nothing. My advice: decide early how a user is named in tokens, in decision requests and in signals, and use the same name in all three.

**The event states a fact, not an order.** It says that the account was disabled. It does not say what the Receiver must do about it. SSF leaves that open, because it "allows each deployment or integration to define its own event processing behaviors, ranging from informational input to additional processing needed, to mandatory enforcement". What happens next is decided by your policy.

## The design, with one more building block

The new building block is the **signal receiver**, which is the SSF Receiver. It listens to the authorization server and passes on what it hears to the PDP.

{{< diagram src="/images/posts/part2-signals.svg" mobile="/images/posts/part2-signals-mobile.svg" caption="The whole flow, from step 0. Highlighted: what this post adds." >}}

Why pass the information to the PDP? Because every tool call already asks the PDP for a decision (step 6). If that one place is told about a change, every call is covered. NIST SP 800-207 describes the same idea: its policy engine "uses enterprise policy as well as input from external sources" in order "to grant, deny, or revoke access to the resource". Signals are that input from outside.

Other components could listen as well, such as the gateway or the MCP server. Putting the receiver next to the PDP is my choice for this design, not a rule from the specification.

The authorization server is also not the only possible Transmitter. For example, CAEP's `device-compliance-change` event "signals that a device's compliance status has changed", and a device management tool is the first to know that. Endpoint security tools and HR systems hold other facts that matter. A design can take a stream from each of them, or it can let the identity provider collect the facts and pass them on. This post keeps a single Transmitter so that the flow stays easy to follow.

## Something changes (steps A to C)

The new steps have letters. The numbered steps are still those of the first post.

At 10:01, the security team disables Alice's account at the authorization server (step A).

The authorization server, acting as the Transmitter, then sends an `account-disabled` event over the stream (step B). The signal receiver gets the event, either by push or by poll, and uses the keys that the authorization server publishes to check that the event really comes from it.

Finally, the signal receiver records the fact where the PDP can use it: Alice's account has been disabled since 10:01 (step C). How it does this is not part of SSF, and it depends on your PDP.

The same path works in the other direction. If the account is enabled again, an `account-enabled` event arrives and the signal receiver clears the fact. Whether a token that was issued before the account was disabled should work again is a policy choice, and it is better to make that choice before the situation comes up.

## The next call (steps 5 to 7)

At 10:02, the agent sends a `tools/call` request for `transfer_funds` to the gateway, with its token (step 5). The token has not changed, and if you look at the token alone, it is still valid.

The gateway asks the PDP, with the same request as in the first post: Alice, this agent, `transfer_funds`, 800 EUR, payee `acct-9920` (step 6).

This time the policy has one more rule, which is mine: *refuse every call made for a user whose account is disabled.* The PDP knows what happened at 10:01, so it answers `"decision": false` (step 7). The gateway stops the call and returns the same `-32001` error as in the first post. Steps 8 to 11 never happen, and the MCP server never sees the request.

The same flow has now given three different answers:

| The call | What decided it | Answer |
| --- | --- | --- |
| 800 EUR to a known payee | The arguments of the call | Allowed |
| 25,000 EUR to a new payee | The arguments of the call | Refused |
| 800 EUR to a known payee, after the account was disabled | What happened since the token was issued | Refused |

The token was the same in all three cases.

## What about the agent itself?

The example signal is about Alice, but the agent has the same gap. [The first post's advice](/posts/securing-ai-agents-part-1-building-blocks/#the-agent-registry) was to check that disabling an agent in the [agent registry](/glossary/#agent-registry) also makes it fail step 3. That stops the agent from getting new tokens. A token that the agent already holds, however, keeps working until it expires. A signal about the agent would be the natural way to close that gap.

The framework has room for this. SSF says that subjects "include human or robotic principals, devices, customer tenants in a multi-tenanted service". Its complex subject format also has a member described as "A Subject Identifier that identifies an application", next to the members for the user, the device and the session.

What is missing is everything else. None of the three specifications mentions AI agents, and the Shared Signals working group's list of specifications has no profile for them. There is no agreed way to name an agent as a subject, and no event that means "this agent was disabled". If you do this today, it is an agreement between your Transmitter and your Receiver, not a standard.

## What this layer does not do

**It is fast, but not instant.** The SSF specification sets no time limit for delivering an event. Measure the delay in your own setup, and decide what a risky tool should do in the meantime.

**Silence is ambiguous.** When no events arrive, it can mean that nothing happened, or it can mean that the stream is broken. The specification says so itself: when events are rare, it is "difficult for an Event Receiver to tell the difference between expected behavior and event transmission failure". Its answer is the verification event: "Event Receivers can request that a Verification Event be transmitted over the Event Stream", and "A Transmitter MAY send a Verification Event at any time". My advice: have the receiver ask for a verification event regularly, let the PDP know how old its last confirmed signal is, and decide in advance what the PDP answers when that signal is too old.

**It only carries what the Transmitter sends.** Which actions in your identity provider produce which events is product behavior, not something the specification promises. Test each event you rely on.

**It does not undo anything.** A signal changes the answer to the next call. The first invoice, paid at 10:00, stays paid.

## What is standard, and what is practice

- **Standard.** SSF 1.0, CAEP 1.0 and RISC 1.0 are Final. So is [AuthZEN](/glossary/#authzen), the API that the gateway uses to ask the PDP, introduced in the first post. [COAZ-MCP](/glossary/#coaz-mcp), which maps an MCP call to that API, is still a draft.
- **Recognized for agents.** The OpenID Foundation's whitepaper points to SSF for revocation. NIST's NCCoE concept paper, which is still a draft, does not mention Shared Signals, but it asks the question that this layer answers: "Can authorization policies be dynamically updated when an agent context changes?" At least one vendor's guidance, Okta's, already recommends SSF and CAEP to revoke an agent's access when risk changes.
- **Practice, not standard.** Where the receiver sits, how it hands facts to the PDP, which events lead to which decisions, and how an agent is named in a signal are all yours to design.

## Who tells whom

| Step | Building block | SSF role | What it does | Standard | Status (November 2026) |
| --- | --- | --- | --- | --- | --- |
| A–B | Authorization server | Transmitter | Sends an event when something changes | SSF 1.0, with RISC 1.0 and CAEP 1.0 events | Final, September 2025 |
| B–C | Signal receiver | Receiver | Receives the event, checks it, records the fact for the PDP | SSF 1.0 | Final, September 2025 |
| 6–7 | PDP | – | Uses the recorded fact in every decision | AuthZEN Authorization API 1.0 | Final, January 2026 |
| – | An agent as the subject of a signal | – | Naming the agent itself in an event | None yet | No standard; an agreement between your Transmitter and Receiver |

## Where this leaves the design

The design now has two layers. The first checks every call before it runs. The second keeps those checks informed after the token was issued.

Together, they mean that every tool call meets three questions, and each question has its own owner:

- **Is this agent known, and is someone accountable for it?** The agent registry and the authorization server answer this, in steps 0 to 4.
- **Is this specific call allowed?** The gateway and the PDP answer this, in steps 5 to 7.
- **Has anything changed since the token was issued?** The signal receiver answers this, in steps A to C, through the PDP.

In none of the examples was it the token that changed the answer. It was what the gateway asked, and what the PDP knew when it was asked.

## What this design still cannot say

Both layers stop at the MCP server. To run `transfer_funds`, the MCP server has to call something else: the service that actually moves the money. The first post already quoted the MCP rule for that hop: "The MCP server MUST NOT pass through the token it received from the MCP client."

So which token does the MCP server present, and how does the next service know that the request is Alice's, made through her agent?

That hop has a standard, OAuth 2.0 [Token Exchange](/glossary/#token-exchange), and it is the subject of [the next post](/posts/securing-ai-agents-part-3-delegation/).

## Sources

- [OpenID Shared Signals Framework Specification 1.0 (Final)](https://openid.net/specs/openid-sharedsignals-framework-1_0-final.html)
- [OpenID Continuous Access Evaluation Profile 1.0 (Final)](https://openid.net/specs/openid-caep-1_0-final.html)
- [OpenID RISC Profile Specification 1.0 (Final)](https://openid.net/specs/openid-risc-1_0-final.html)
- [OpenID Foundation: Three Shared Signals Final Specifications Approved (September 2025)](https://openid.net/three-shared-signals-final-specifications-approved/)
- [OpenID Shared Signals working group specifications](https://openid.net/wg/sharedsignals/specifications/)
- [RFC 8417: Security Event Token (SET)](https://www.rfc-editor.org/rfc/rfc8417.html)
- [RFC 8935: Push-Based Security Event Token (SET) Delivery Using HTTP](https://www.rfc-editor.org/rfc/rfc8935.html)
- [RFC 8936: Poll-Based Security Event Token (SET) Delivery Using HTTP](https://www.rfc-editor.org/rfc/rfc8936.html)
- [NIST SP 800-207: Zero Trust Architecture (August 2020)](https://csrc.nist.gov/pubs/sp/800/207/final)
- [RFC 7662: OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662.html)
- [OpenID Foundation: Identity Management for Agentic AI (October 2025)](https://openid.net/new-whitepaper-tackles-ai-agent-identity-challenges/), and [its full text on arXiv](https://arxiv.org/abs/2510.25819)
- [NIST NCCoE: Accelerating the Adoption of Software and AI Agent Identity and Authorization, concept paper (draft, February 2026)](https://www.nccoe.nist.gov/sites/default/files/2026-02/accelerating-the-adoption-of-software-and-ai-agent-identity-and-authorization-concept-paper.pdf)
- [Vendor guidance: Okta, "The role of AI in IAM: Securing the agentic frontier"](https://www.okta.com/identity-101/role-of-ai-in-iam/)
- [OpenID AuthZEN Authorization API 1.0 (Final)](https://openid.net/specs/authorization-api-1_0.html)
