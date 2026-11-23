# Cloud Run: the commands

These are the commands for [running Alice on Cloud Run](README.md), in order. Pablo runs them in his own terminal, from the repository root, after `gcloud` is installed and he is signed in. None was run when this page was written, so read each before running it. `REGION` is the Cloud Run region nearest to him.

Steps 1 and 2 are done once; steps 3 to 5 are repeated for every new version. The [guide](README.md) has the picture of what runs where.

## 1. Project and services, once

Set the region once per terminal; `gcloud run regions list` shows the choices.

```bash
REGION=us-east1
```

```bash
gcloud config set project YOUR_PROJECT_ID
```

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 2. The two secrets, once

The first command reads the key from `poc/.env.local` and sends it to Secret Manager without showing it. The second asks for the access code without echoing it; type it and press Enter.

```bash
grep -m1 '^OPENAI_API_KEY=' poc/.env.local | cut -d= -f2- | tr -d '\r\n' | gcloud secrets create alice-openai-key --replication-policy=automatic --data-file=-
```

```bash
read -rs CODE; printf '%s' "$CODE" | gcloud secrets create alice-access-code --replication-policy=automatic --data-file=-; unset CODE
```

```bash
NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)'); for s in alice-openai-key alice-access-code; do gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:${NUMBER}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor; done
```

## 3 to 5. Stage, deploy, set the host

```bash
bash poc/deploy/stage.sh
```

```bash
gcloud run deploy alice --source poc/deploy/.stage --region "$REGION" \
  --allow-unauthenticated --timeout=3600 --max-instances=1 --memory=512Mi \
  --set-secrets=OPENAI_API_KEY=alice-openai-key:latest,ALICE_ACCESS_CODE=alice-access-code:latest \
  --set-env-vars=ALICE_LOG=off,ALICE_AVATAR=off,ALICE_PUBLIC_HOST=pending
```

```bash
URL=$(gcloud run services describe alice --region "$REGION" --format='value(status.url)'); gcloud run services update alice --region "$REGION" --update-env-vars="ALICE_PUBLIC_HOST=${URL#https://}"; echo "$URL"
```

- **Why two steps.** The address is known only after the first deploy. With `pending` the service starts but answers 403 to everyone; the second command gives it its real name.
- **`--timeout=3600`** keeps a WebSocket open for up to an hour; the default cuts it after five minutes.
- **`--max-instances=1`** because the package and the one-session rule live in one instance's memory.

## 6. On the iPad

Open the printed address in Safari, enter the access code, allow the microphone and press Start listening. Keep the iPad awake: Safari stops the microphone when the screen locks.

## Taking it down

```bash
gcloud run services delete alice --region "$REGION"
```

Deleting the service stops all cost and access. The two secrets stay until deleted with `gcloud secrets delete`. Return to the [guide](README.md).
