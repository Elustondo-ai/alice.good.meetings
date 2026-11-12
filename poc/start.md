# Start the local POC

[start.sh](start.sh) locates Node and launches the server without printing the credential file.

| Component | Responsibility | Collaborator |
| --- | --- | --- |
| Shell launcher | Changes into `poc/` and finds a Node executable | `SPEAKERCOACH_NODE`, PATH or bundled Codex runtime |
| Node | Loads `.env.local` and executes the server | [Server](server.md) |

Run `bash poc/start.sh` from the repository root. Node.js 22+ and the dependencies from `package.json` must already be installed.
The launcher prefers `SPEAKERCOACH_NODE`, then `node` on PATH, then the installed Codex primary runtime under the user's home directory.
It exits with an explanatory error if no executable is available. Server output and exit status are passed through using `exec`.
Use Ctrl+C to stop the server. This launcher neither installs dependencies nor changes keys or model settings.
