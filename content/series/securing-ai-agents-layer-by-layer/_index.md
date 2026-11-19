---
title: "Securing AI Agents, Layer by Layer"
description: "One design for keeping an AI agent in check, built one layer per post, with the same payment as the example throughout."
# Parts still to come, shown on this page as "Coming next". Leave empty to show nothing.
upcoming: []
---

An AI agent decides at runtime which tool to call, and with which arguments. Most identity systems were built for clients that do what they were coded to do, and that one difference breaks several of their assumptions.

This series builds one design for keeping such an agent in check, one layer per post. Every post follows the same example: Alice asks her finance assistant, an AI agent, to pay an invoice. The steps keep their numbers from post to post, so each layer can be read as an addition to the one before.

Each layer answers a question the token cannot answer alone:

| Layer | The question | Answered by |
| --- | --- | --- |
| [1. The Building Blocks](/posts/securing-ai-agents-part-1-building-blocks/) | Is this specific call allowed? | The gateway and the policy decision point, on every call |
| [2. Shared Signals](/posts/securing-ai-agents-part-2-shared-signals/) | Has anything changed since the token was issued? | Shared Signals, through the policy decision point |
| [3. Delegation](/posts/securing-ai-agents-part-3-delegation/) | Who is acting for whom, after the first hop? | OAuth Token Exchange and the `act` claim |
| [4. Proof of Possession](/posts/securing-ai-agents-part-4-proof-of-possession/) | Is the one presenting the token the one it was issued to? | DPoP or mutual TLS |

The terms used across the series are explained in the [glossary](/glossary/).
