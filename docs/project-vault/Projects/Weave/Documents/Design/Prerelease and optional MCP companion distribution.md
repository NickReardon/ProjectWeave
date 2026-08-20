---
type: document
document_kind: design
title: Prerelease and optional MCP companion distribution
scope: project
project: '[[Projects/Weave/Project]]'
created: 2026-08-16
---

# Prerelease and optional MCP companion distribution

## Outcome

Project Weave uses the standard Obsidian package for BRAT and future Community
Plugin installs while keeping its desktop MCP companion available as an
optional asset from the same repository and release.

## Contract

- BRAT and Obsidian install `main.js`, `manifest.json`, and `styles.css` only.
- `project-weave-mcp.cjs` is built and published separately from the same
  accepted source ref.
- The plugin does not download or manage the companion.
- The README provides the explicit pinned installation command, checksum,
  compatibility information, and MCP client setup.
- Weave remains fully useful on desktop and mobile without the companion.

The canonical product contracts are [[Documents/Specifications/quality-and-release|Quality and release]]
and [[Documents/Specifications/agent-access-and-mcp|Agent access and MCP]]. The rationale is
recorded in [[Documents/Decisions/0021-distribute-the-mcp-companion-as-an-optional-release-asset|ADR 0021]].

## Delivery sequence

1. Separate plugin and companion artifact inventories.
2. Add the public release metadata and optional-agent setup documentation.
3. Automate an explicit-ref BRAT prerelease with the companion attached as an
   additional asset.
4. Install through BRAT and separately configure the companion in a real MCP
   client before calling the preview channel ready.

The linked tasks under the shipping Epic carry the executable acceptance
criteria and validation work.
