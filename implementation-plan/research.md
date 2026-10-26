# Implementation plan research decisions

## Decision: plain browser stack

- **Decision:** Use plain HTML5, CSS, and browser JavaScript modules. Do not introduce React, TypeScript, a framework, package manifest, or third-party runtime dependency.
- **Rationale:** The product owner explicitly requested “plain js, html and css only.” The existing independent HTML books and UI investigation are already browser-native; a static app can keep deployment simple and avoid adding a build/runtime stack.
- **Alternatives considered:** React + TypeScript + Vite; vanilla TypeScript + Vite; .NET or Spring backend with a plain-JS frontend. These were not selected because the owner requested plain JavaScript/HTML/CSS, and subsequently confirmed static-only scope.
- **Environment check:** Node.js 18.19.1 and Python 3.12.3 are available. Node can run syntax and integrity checks; Python's standard library can serve the app locally over HTTP. npm is installed but unnecessary.

## Decision: static-only MVP boundary

- **Decision:** Keep shared catalog metadata in versioned `data/catalog.json`, book HTML in `book/`, and reader-private data in browser IndexedDB. Do not build a catalog API, relational database, or authenticated editor service in this phase.
- **Rationale:** The owner confirmed that the implementation should be static-only after the API/database conflict with the requested technology boundary was surfaced.
- **Alternatives considered:** Plain JavaScript frontend backed by a separate server/API and database; this would preserve authenticated editor publishing but contradict the confirmed static-only choice.
- **Consequences:** FR-040 and the authenticated portions of FR-041 are deferred. Static hosting cannot guarantee immediate revocation of direct or cached book URLs as required by FR-042. Repository permissions protect manifest/file changes but are not presented as in-app editor authorization. The static MVP must document these gaps instead of simulating security in client code.
