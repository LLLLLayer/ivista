# iVista Report Workflow

## Check The Current Run

Always start by checking the current project/conversation/run context:

```bash
ivista run current
```

The run directory has this shape:

```text
~/.ivista/projects/<project-key>/conversations/<conversation-id>/runs/<run-id>/
  run.json
  events.ndjson
  artifacts/
    0001-screenshot.png
    0002-source.xml
    0003-texts.json
```

Exports are written next to the conversation:

```text
~/.ivista/projects/<project-key>/conversations/<conversation-id>/exports/
  ivista-run-<run-id>.md
  ivista-run-<run-id>.zip
```

## Start A Run When Needed

If there is no current run, create one before operating the device:

```bash
ivista run start --project . --conversation <conversation-id> --run <run-id>
```

If the agent does not know the real conversation id, use a stable task name:

```bash
ivista run start --project . --conversation codex-session --run smoke-settings
```

## Capture Useful Artifacts

Screenshots, source, and accessibility texts are automatically saved into the current run:

```bash
ivista screen shot --port <port>
ivista screen source --port <port>
ivista screen texts --port <port>
```

If the user passes `--output`, iVista still saves a copy under the current run artifacts:

```bash
ivista screen shot --port <port> --output /tmp/ivista.png
```

Every non-run CLI command appends a compact event to `events.ndjson`.

## Export

Readable report:

```bash
ivista run export --format markdown
```

Shareable debug bundle:

```bash
ivista run export --format zip
```

Explicit output path:

```bash
ivista run export --format markdown --output /tmp/ivista-report.md
ivista run export --format zip --output /tmp/ivista-run.zip
```

## Report Contents

The Markdown report includes:

- project metadata
- conversation id
- run id
- command counts and failed command count
- artifact table
- screenshot previews
- accessibility text snapshot summaries
- failure section with fix hints
- event timeline
- command summaries with raw JSON

The zip bundle includes:

- `run.json`
- `events.ndjson`
- `artifacts/`
- `run-report.md`

It intentionally excludes generated `ivista-run-*` export files and macOS `._` metadata files.
