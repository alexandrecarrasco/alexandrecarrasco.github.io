---
title: "Identity, AI Agents and Adoption: Where We Really Are"
lastChecked: 2026-11-18   # when the facts and statuses were last verified against the sources
updates:
  - date: 2026-11-19
    note: "Rewritten to be easier to read. The opinions are the same."
date: 2026-11-18T20:40:00Z
lastmod: 2026-11-19
draft: false
toc: true
aliases: ["/blogs/identity-agents-and-adoption/"]
writtenWith: "Written with Claude. The opinions are mine."
tags: ["ai-agents", "authorization"]
description: "Identity finally has a seat at the table, AI agents are arriving fast, and authorization is the hard part. My view on where we really are, and what to do now."
summary: "Identity finally has a seat at the board table, AI agents are arriving faster than most programs can absorb them, and authorization is still the hard part. This post is my view of where we really are: what is changing, what is not, which standards are closer than they look, and what I would do now."
---

Identity finally has a seat at the board table, AI agents are arriving faster than most programs can absorb them, and authorization is still the hard part. This post is my view of where we really are: what is changing, what is not, which standards are closer than they look, and what I would do now.

## Identity finally has a seat at the table

For a long time, identity had the same problems year after year. Applications were never connected to governance, nobody could explain who had access to what, and access reviews were a checklist exercise. Those problems have not gone away. What has changed in the last couple of years is that real innovation is now aimed at them, and that people above the identity team are paying attention.

Identity is now a board-level topic, and the reason is simple. It is the biggest attack surface that most organizations have, and AI makes it bigger, because every agent that can act is another identity that can be misused.

That does not mean starting over. I would not rip and replace what already works. The better move is to keep the platforms you have and to use AI where it helps most. One example is onboarding the long tail of applications to identity governance, which AI can do much faster than the manual way ever did.

## Authorization is the hard part

We have spent years on authentication, and passwordless is on most roadmaps by now. Authorization has had far less attention, and it is now the part that matters most, because you cannot govern agents without it. A review of who had what access last quarter is too slow for something that acts in seconds. The decision has to happen at runtime, on every call.

Will we get one authorization standard that everyone uses? I doubt it, at least not in the form of a single policy language. The large platforms are not going to rebuild the way they authorize, and a new standard only spreads as new applications adopt it. Authorization also depends on the domain. A language that is general enough to serve everyone ends up shallow, and each domain still has to fill in its own details.

I also don't think that a single standard is the right goal. The last few years have already made authorization more organized. We now have policy engines such as Open Policy Agent and Cedar, products that are built to externalize decisions, and a standard way to *ask* for a decision. That standard is the OpenID [AuthZEN Authorization API 1.0](https://openid.net/specs/authorization-api-1_0.html), which has been Final since January 2026. It standardizes the question (subject, action, resource, context) and leaves the policy language to each product. This common layer is thin on purpose, and it is enough to put a policy decision point in front of an agent's tool calls, as I showed in [the first post of my series](/posts/securing-ai-agents-part-1-building-blocks/).

Standards like this one grow out of deployments, and not out of a room full of people designing the perfect schema. You build things, you notice that several of them are really the same thing, and you standardize that part. There are limits to how far this can go, but it will keep getting better.

## AI agents: the same mistakes, faster

Here is my prediction. We spent more than twenty years on human identity, we solved much of it, and we did it in silos. With agents, everything moves faster, and I expect us to repeat the same pattern, with separate tools for separate kinds of agents and gaps between them.

Many vendors already say that they govern agentic AI. Most of them cover some kinds of agents and not others. I would expect blind spots for at least a year or two, and I don't think identity programs can afford to take five years to mature anymore.

The first question I would ask is about delegation. An agent that I start should not have all of my access. It should have only what I delegate to it. So where is that delegation enforced: at the service that the agent calls, or inside the platform where the agent was built? Today the honest answer is often "neither, consistently", and that is one of the gaps.

## What runtime control for agents looks like

Two basics come before any runtime control: every agent needs its own identity, and every agent needs an owner.

After that, I see three problems, and each one is harder than the one before.

**Just-in-time access through a gateway.** The agent reaches other systems through a gateway, which grants permissions for one task and takes them away afterwards. When the gateway is combined with threat detection, it can also cut an agent's access the moment its behavior looks wrong. Products already do this.

**A human in the loop, as policy.** When an agent meets something ambiguous or privileged, it should ask a person. Today that step is usually written into the agent's own code, which is the wrong place for it, because it should be a policy decision. The standard pieces already exist. The OpenID Foundation's [CIBA](https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html), Final since 2021, defines how a service can ask a user to authenticate and approve on a separate device. MCP has [elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation), which lets a server ask the user for input through the client. What no standard says yet is *when* policy must require that approval.

**Access that matches intent.** An agent may be allowed to use a system in general, but is that access relevant to *this* request? Turning a natural-language prompt into attributes that a policy can evaluate is not a solved problem, and the products that try to do it are young. Catching clear drift, meaning an action that obviously does not fit the request, is easier. My advice: start where it is already possible. A policy decision point can judge each call on its arguments, as in the payment example in my series. It does not read the prompt, but it closes much of the gap at the moment the action happens.

Most teams also want something that works now, not research. In practice, that means on-behalf-of flows, delegation, and workarounds for legacy systems that will never speak OAuth.

## The foundations still matter

AI is not the whole agenda, and I would be wary of any plan that treats it as if it were.

Identity governance, privileged access and machine identity still have to be done. Many zero trust programs stalled once the excitement faded, and they still need to be finished. Post-quantum cryptography is an identity problem too, because federation, FIDO and OpenID Connect all rest on public key cryptography. Certificate lifecycle management is also about to get much busier, as certificate lifetimes keep shrinking.

The newest category to watch is IVIP, which stands for identity visibility and intelligence platforms. An IVIP is a layer that gathers identity data from all your systems and analyses it, instead of replacing those systems. Most organizations still cannot say who has access to what, and visibility comes before control. I expect IVIP to eat into the low end of identity governance. For small and mid-size organizations, one platform may cover basic governance and just-in-time privileged access without separate investments, and it may let teams act before problems happen instead of after. The category is young and this is a prediction, so I would judge each product on what it actually does.

## Standards are closer than they look

Here are two examples where the standards are further along than people often assume.

**Agents crossing trust domains.** An agent in one organization that calls an MCP server in another, through more than one authorization server, sounds like future work. In fact, the pieces are already here. OAuth's [Identity and Authorization Chaining Across Domains](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-chaining/) has been approved and is in the RFC Editor queue, and MCP's [Enterprise-Managed Authorization extension](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization) already combines Token Exchange with a JWT grant. I walked through the same building blocks in [the third post of my series](/posts/securing-ai-agents-part-3-delegation/).

**Shared Signals.** A standard covers the events that a group agreed on, not every event that matters, and that is a fair limit. However, the agreed set is larger than it is often described. The Final specifications define eight [CAEP](https://openid.net/specs/openid-caep-1_0-final.html) events and thirteen [RISC](https://openid.net/specs/openid-risc-1_0-final.html) events. [The second post of my series](/posts/securing-ai-agents-part-2-shared-signals/) lists the CAEP events and follows one RISC event through a design.

On decentralized identity, my view depends on where you stand. Here in Europe, regulation and data sovereignty give it real momentum, and I expect the first serious use cases to come from here. For an organization that sets it up on its own for workforce use, with no regulation behind it, I don't yet see a strong reason.

## What I would do now

My advice: don't wait for a universal authorization standard. Put a decision point in front of every agent's tool calls now, using the standard interface that already exists, and keep the policy behind it simple enough to change. Give every agent an identity and an owner. Get visibility before you buy control. And when a vendor says that it governs agents, ask which ones.

