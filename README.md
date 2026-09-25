# OCS Study Dashboard

## Overview

**OCS Study Dashboard** is a web-based study platform designed to organize learning resources for second-year students across three study options:

- **Cybersécurité**
- **Cloud Computing**
- **Systèmes et Réseaux**

The platform brings courses, PDF documents, and other study resources together in one place.

## Main Features

- Study dashboard for second-year students
- Organization by study option
- Course and lesson resources
- PDF learning materials
- Centralized study resources
- Browser-based access

## Study Options

### Cybersécurité

Courses and learning resources related to the Cybersecurity option.

### Cloud Computing

Courses and learning resources related to the Cloud Computing option.

### Systèmes et Réseaux

Courses and learning resources related to Systems and Networks.

## Project Objective

The objective is to provide students with a simple and organized digital space for accessing their academic resources.

Instead of keeping courses and PDF documents scattered across different locations, the dashboard groups them by option and makes them easier to access.

## Project Structure

```text
OCS Study Dashboard
├── Cybersécurité
│   └── Courses / PDF resources
├── Cloud Computing
│   └── Courses / PDF resources
└── Systèmes et Réseaux
    └── Courses / PDF resources
```

## Learning Purpose

This project is part of my personal learning and development work. It combines web development with the practical organization of academic study resources.

## Versioning

The application version follows a permanent custom format:

```text
V<MAJOR>.<MONTH>-<UPDATE>
```

| Component  | Meaning                                                                     |
| ---------- | --------------------------------------------------------------------------- |
| `MAJOR`    | Project phase/generation (`V1`, `V2`, ...). Only changed on explicit decision. |
| `MONTH`    | Two digits, `01`-`12` (`01` = January ... `12` = December).                   |
| `UPDATE`   | Two digits, `01`-`10`, the update counter within that month.                 |

Examples: `V1.09-01`, `V1.09-02`, ... `V1.09-10`, then `V1.10-01` when October starts, then `V2.01-01` when a new major phase begins.

Rules:

- The version is stored in a single place: `APP_VERSION` in `lib/app-info.ts`, and displayed in the app footer.
- For each new update: keep `MAJOR`, use the current month, and increment `UPDATE` (reset to `01` when the month changes).
- `MAJOR` is never incremented automatically. A new major phase is only started on explicit request.
- Never convert to Semantic Versioning, never use a date as the version, never duplicate the version string elsewhere.
- Every update adds a matching entry to [`CHANGELOG.md`](./CHANGELOG.md).

## Status

**Active project**

The platform can evolve as new courses, documents, and features are added.

## Author

**Bilal Touati**

Cybersecurity Student

## Live Application

[OCS Study Dashboard](https://idoptioncyber.vercel.app/)
