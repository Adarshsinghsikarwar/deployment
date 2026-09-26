# CI/CD Troubleshooting Notes

Yeh guide project ke CI/CD issues, fixes, aur future checklist ko document karti hai.

## Current Setup

### CI: `.github/workflows/ci.yml`

CI run hota hai:

- Pull request targeting `main`
- Push to `main`

CI ke steps:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm build`

### CD: `.github/workflows/cd.yml`

CD `main` par push ke baad:

1. Docker Hub login karta hai.
2. Docker image build aur push karta hai.
3. SSH ke through EC2 par connect karta hai.
4. New image pull karta hai.
5. Purana `todo-app` container stop/remove karta hai.
6. New container ko port `3000` par run karta hai.

## Issues We Faced And Fixes

### 1. pnpm version conflict

Error:

```text
Multiple versions of pnpm specified
```

Cause: pnpm version workflow aur `package.json` dono jagah defined thi.

Fix: CI workflow se `version: 10` remove kiya. Ab workflow `package.json` se exact version leta hai:

```json
"packageManager": "pnpm@10.29.3"
```

Rule: pnpm version ke liye ek hi source of truth rakho.

### 2. Local lint fail hua because dependencies missing thi

Error:

```text
'eslint' is not recognized
node_modules missing
```

Fix:

```bash
pnpm install --frozen-lockfile
```

Uske baad lint, type check, test, aur build pass hue.

### 3. `pnpm test` script missing thi

Fix: `package.json` mein add kiya:

```json
"test": "node --test"
```

Command ab pass hoti hai, lekin currently actual tests nahi hain, isliye result `0 tests` hai.

Rule: Test command pass hona aur actual tests hona alag cheezein hain.

### 4. CI aur Docker mein Node version mismatch

Pehle CI Node `24` use kar raha tha aur Dockerfile Node `20`.

Fix: CI ko Node `20` par align kiya.

Rule: CI, Docker, aur production mein compatible Node versions rakho.

### 5. TypeScript `LayoutProps` error in CI

CI ke Type check step par yeh error aaya:

```text
src/app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'.
```

Cause: `src/app/layout.tsx` mein `LayoutProps<"/">` use hua tha, lekin `LayoutProps` project mein defined ya imported nahi tha. Is wajah se `pnpm exec tsc --noEmit` fail hua.

Fix: Undefined type ko standard React `ReactNode` type se replace kiya:

```tsx
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
```

Verification:

```bash
pnpm exec tsc --noEmit
```

Result: TypeScript check pass ho gaya.

Rule: CI mein type check ko ignore mat karo. Local changes ke baad `pnpm exec tsc --noEmit` zaroor run karo.

### 6. CD YAML indentation error

`cd.yml` mein kuch YAML keys inconsistent indentation ke saath likhi hui thi. Example ke taur par `if`, `runs-on`, `environment`, aur `steps` ek hi job ke andar same level par nahi the.

Is wajah se GitHub Actions workflow ko parse karne ya run karne mein failure aa sakta tha.

Fix: `cd.yml` ko standard two-space YAML indentation ke saath format kiya gaya. `deploy` job ke andar `if`, `runs-on`, `environment`, aur `steps` ab same indentation level par hain.

Verification:

```bash
git diff --check -- .github/workflows/cd.yml
```

Result: Workflow formatting validation pass hui.

Rule: GitHub Actions YAML mein tabs mix mat karo; consistent spaces use karo.

### 7. SSH action version error

CD run karte waqt yeh error aaya:

```text
Unable to resolve action `appleboy/ssh-action@1.2.0`, unable to find version `1.2.0`
```

Cause: GitHub Action ka release tag `v1.2.0` hai, lekin workflow mein `1.2.0` likha hua tha. GitHub Actions exact tag search karta hai, isliye action resolve nahi hua.

Fix:

```yaml
uses: appleboy/ssh-action@v1.2.0
```

Rule: GitHub Action versions mein repository ka exact release tag use karo, including `v` prefix agar tag mein present ho.

### 8. Docker login action deprecation warning

CD ke Docker login step par yeh warning dikhi:

```text
[DEP0040] DeprecationWarning: The `punycode` module is deprecated.
Please use a userland alternative instead.
```

Cause: `docker/login-action@v3` ki internal Node.js dependency deprecated `punycode` module use kar rahi hai. Yeh warning action ke internal code se aati hai, application ya Dockerfile se nahi.

Impact: Yeh warning non-blocking hai. Agar step ke end mein `Process completed with exit code 0` aaye, Docker login successful hai aur deployment continue kar sakta hai.

Action: Workflow ko change karne ki zaroorat nahi hai. `docker/login-action@v3` use karte raho aur future mein action ka newer release available ho to update karo.

Rule: Deprecation warning ko failure na samjho; hamesha final exit code check karo.

### 9. CI aur CD ka difference

- CI code ko validate karta hai.
- CD Docker image ko Docker Hub par push karke EC2 par deploy karta hai.
- Dockerfile image banane ke instructions deta hai.

## Important Checks

### Docker login credentials missing

CD ke Docker login step par yeh error aaya:

```text
Error: Username and password required
```

Cause: Login action ko username ya password empty mil raha tha. Workflow mein Docker credentials ke liye inconsistent secret names use ho rahe the.

Fix: Login aur image tag dono ke liye same username secret use kiya:

```yaml
username: ${{ secrets.DOCKERHUB_USERNAME }}
password: ${{ secrets.DOCKERHUB_TOKEN }}
```

GitHub repository ke `production` environment mein yeh secrets exact same names ke saath configure hone chahiye:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_HOST`
- `EC2_USERNAME`
- `EC2_SSH_KEY`

`Settings > Environments > production` mein secrets check karo. Secret values ko workflow logs mein print mat karo.

### 10. EC2 server host missing

SSH deployment step par yeh error aaya:

```text
Error: missing server host
```

Cause: `appleboy/ssh-action` ko `EC2_HOST` secret ki value nahi mili. Workflow mein host is tarah read hota hai:

```yaml
host: ${{ secrets.EC2_HOST }}
```

Fix: GitHub ke `production` environment mein exact name ke saath `EC2_HOST` secret add karo. Value EC2 ka public IPv4 address ya public DNS hona chahiye, example:

```text
18.123.45.67
```

Value mein `http://`, `https://`, ya extra path mat add karo. Saath mein `EC2_USERNAME` aur `EC2_SSH_KEY` bhi isi `production` environment mein configured hone chahiye.

Rule: Secret names case-sensitive hote hain. Workflow ke secret name aur GitHub Environment secret name exactly same hone chahiye.

### CI aur CD parallel run hone ki problem

Pehle dono workflows `main` push par directly trigger hote the. Isliye CD, CI ke complete hone ka wait nahi karta tha. CI fail hone par bhi CD deploy attempt kar sakta tha.

Fix: CD ko `workflow_run` event par change kiya gaya. Ab CD:

- Sirf `CI` workflow complete hone ke baad start hota hai.
- Sirf successful CI ke baad deploy karta hai.
- Sirf push-based CI run ke liye deploy karta hai, pull request ke liye nahi.
- CI se validate hui exact commit SHA ko Docker image mein use karta hai.

Rule: Deployment ko validation workflow ke successful completion ke baad hi run karo.

### CI mein test step

`package.json` mein test script hai, lekin current CI workflow mein `pnpm test` step nahi hai. Add karne ke liye:

```yaml
- name: Test
	run: pnpm test
```

## Validation Checklist

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm test`
- `pnpm build`
- `docker build -t deployment:test .`
- Docker Hub secret names check karo.
- EC2 par Docker installed hai ya nahi check karo.
- EC2 security group mein port `3000` allowed hai ya nahi check karo.
- Deployment ke baad `docker ps` aur application URL check karo.

## Useful Commands

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
docker build -t deployment:test .
docker run --rm -p 3000:3000 deployment:test
```
