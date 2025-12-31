# Version Control Workflow

Dokumentasi ini menjelaskan alur kerja version control yang digunakan dalam proyek SMILE Platform.

## Ringkasan Strategi Branching

```mermaid
graph TB
    subgraph "Development Flow"
        DEV[Developer] -->|create| FEATURE[feature/*, feat/*, fix/*]
        FEATURE -->|merge| DEV_BRANCH[dev branch]
    end

    subgraph "Deployment Targets"
        DEV_BRANCH -->|auto deploy| SERVER_DEV[Server Dev<br/>badr]
        DEV_BRANCH -->|merge untuk staging| MAIN[main branch]
        MAIN -->|auto deploy| SERVER_STAGING[Server Staging/UAT<br/>AWS]
        DEV_BRANCH -->|merge untuk training| TRAINING[training branch]
        TRAINING -->|auto deploy| SERVER_TRAINING[Server Training<br/>AWS<br/>shared app, separate data]
        MAIN -->|create tag untuk dry run/maintenance| RELEASE[release-* tag]
        RELEASE -->|auto deploy| SERVER_RELEASE[Server Release<br/>dry run, maintenance, migration]
        MAIN -->|create tag untuk production| PROD[prod-* tag]
        PROD -->|manual deploy| SERVER_PROD[Server Production<br/>SMILE 5.0<br/>dedicated server]
    end

    subgraph "Hotfix Flow"
        PROD_TAG[Latest prod-* tag] -->|checkout to| PROD_SMILE[prod-smile branch]
        PROD_SMILE -->|work on| HOTFIX_BRANCH[prod-smile branch]
        HOTFIX_BRANCH -->|create new| NEW_PROD_TAG[prod-* tag<br/>semantic versioning<br/>patch increment]
    end

    style SERVER_DEV fill:#e1f5ff
    style SERVER_STAGING fill:#fff4e1
    style SERVER_TRAINING fill:#f0e1ff
    style SERVER_RELEASE fill:#ffe1e1
    style SERVER_PROD fill:#e1ffe1
```

## Alur Kerja Detail

```mermaid
gitGraph
    commit id: "Initial"
    branch dev
    checkout dev
    commit id: "Dev init"

    branch feature/user-auth
    checkout feature/user-auth
    commit id: "Add login"
    commit id: "Add register"
    checkout dev
    merge feature/user-auth tag: "→ badr server"

    branch feat/dashboard
    checkout feat/dashboard
    commit id: "Dashboard UI"
    checkout dev
    merge feat/dashboard

    branch fix/login-bug
    checkout fix/login-bug
    commit id: "Fix validation"
    checkout dev
    merge fix/login-bug
    commit id: "Dev stable" tag: "→ badr server"

    checkout main
    branch main
    merge dev tag: "v1.0.0 → AWS staging"

    branch training
    checkout training
    commit id: "Training data" tag: "→ AWS training"

    checkout main
    branch release-1.0.0
    checkout release-1.0.0
    commit id: "Dry run prep" tag: "→ release domain"

    checkout main
    commit id: "Prod ready" tag: "prod-1.0.0 → Production"

    branch prod-smile
    checkout prod-smile
    commit id: "Prod deploy"

    branch hotfix
    checkout hotfix
    commit id: "Critical fix"
    checkout prod-smile
    merge hotfix
    commit id: "Hotfix applied" tag: "prod-1.0.1 → Production"
```

## Branch Strategy

### 1. Development Branches

#### Feature/Fix Branches

- **Pattern**: `feature/*`, `feat/*`, `fix/*`
- **Dibuat oleh**: Developer
- **Merge ke**: `dev`
- **Contoh**:
  - `feature/user-authentication`
  - `feat/dashboard-redesign`
  - `fix/login-validation`

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant FB as Feature Branch
    participant DevB as dev Branch
    participant Server as Server Dev (badr)

    Dev->>FB: Create feature/feat/fix branch
    Dev->>FB: Commit changes
    Dev->>FB: Push to remote
    Dev->>DevB: Create merge request
    DevB->>DevB: Code review & approval
    DevB->>FB: Merge
    DevB->>Server: Auto deploy
```

### 2. Main Deployment Branches

#### Dev Branch

- **Target**: Server Development (badr)
- **Auto Deploy**: ✅ Yes
- **Purpose**: Development testing

```mermaid
flowchart LR
    A[feature/feat/fix] -->|merge| B[dev]
    B -->|auto deploy| C[Server Dev<br/>badr]
```

#### Main Branch

- **Source**: Merge dari `dev`
- **Target**: Server Staging/UAT (AWS)
- **Auto Deploy**: ✅ Yes
- **Purpose**: Pre-production testing
- **Kapan merge**: Ketika ada perubahan yang ingin dilihat/deploy ke staging

```mermaid
flowchart LR
    A[dev] -->|merge untuk staging| B[main]
    B -->|auto deploy| C[Server Staging/UAT<br/>AWS]
```

#### Training Branch

- **Source**: Merge dari `dev`
- **Target**: Server Training (AWS)
- **Auto Deploy**: ✅ Yes
- **Purpose**: Training environment
- **Note**: Shared application with staging, separate database
- **Kapan merge**: Ketika ada keperluan training

```mermaid
flowchart LR
    A[dev] -->|merge untuk training| B[training]
    B -->|auto deploy| C[Server Training<br/>AWS<br/>Shared app, separate data]
```

### 3. Release Tags

#### release-\* Tag

- **Pattern**: `release-1.0.0`, `release-2.1.0`
- **Source**: Dibuat dari `main` branch
- **Target**: release.smile-indonesia.id
- **Auto Deploy**: ✅ Yes
- **Kapan dibuat**: Ketika ada keperluan:
  - Dry run testing
  - Maintenance clone of production
  - Data migration testing

```mermaid
flowchart TB
    A[main branch] -->|create tag untuk<br/>dry run/maintenance| B[release-*]
    B -->|auto deploy| C[release.smile-indonesia.id]
    C -->|purposes| D[Dry Run]
    C -->|purposes| E[Maintenance Clone]
    C -->|purposes| F[Data Migration]
```

### 4. Production Tags

#### prod-\* Tag

- **Pattern**: `prod-1.0.0`, `prod-1.0.1`
- **Source**: Dibuat dari `main` branch
- **Target**: Server Production SMILE 5.0
- **Deploy**: Manual
- **Versioning**: Semantic Versioning
- **Server**: Dedicated production server
- **Kapan dibuat**: Ketika siap untuk production release

```mermaid
flowchart TB
    A[main branch] -->|create tag untuk<br/>production| B[prod-*]
    B -->|manual deploy| C[Production Server<br/>SMILE 5.0<br/>AWS]
    B -->|follows| D[Semantic Versioning<br/>MAJOR.MINOR.PATCH]
```

### 5. Hotfix Workflow

```mermaid
flowchart TB
    A[Latest prod-* tag] -->|checkout| B[prod-smile branch]
    B -->|create| C[prod-smile branch]
    C -->|work on fix| D[Commit changes]
    D -->|merge back| B
    B -->|create new tag| E[prod-* tag<br/>increment patch version]
    E -->|deploy| F[Production Server]

    style A fill:#ffe1e1
    style E fill:#e1ffe1
```

## Semantic Versioning untuk Production

```mermaid
graph LR
    A[prod-MAJOR.MINOR.PATCH] --> B[MAJOR: Breaking changes]
    A --> C[MINOR: New features]
    A --> D[PATCH: Bug fixes]

    style B fill:#ff6b6b
    style C fill:#4ecdc4
    style D fill:#95e1d3
```

### Contoh:

- `prod-1.0.0` → Initial production release
- `prod-1.0.1` → Hotfix/patch
- `prod-1.1.0` → New feature (backward compatible)
- `prod-2.0.0` → Breaking changes

## Environment Overview

```mermaid
graph TB
    subgraph "Development"
        DEV[dev branch<br/>→ Server Dev badr]
    end

    subgraph "Staging"
        MAIN[main branch<br/>→ Server Staging AWS]
        TRAINING[training branch<br/>→ Server Training AWS]
    end

    subgraph "Pre-Production"
        RELEASE[release-* tag<br/>→ release.smile-indonesia.id]
    end

    subgraph "Production"
        PROD[prod-* tag<br/>→ Production Server]
    end

    DEV -->|merge untuk staging| MAIN
    DEV -->|merge untuk training| TRAINING
    MAIN -->|create tag untuk dry run| RELEASE
    MAIN -->|create tag untuk production| PROD

    style DEV fill:#e1f5ff
    style MAIN fill:#fff4e1
    style TRAINING fill:#f0e1ff
    style RELEASE fill:#ffe1e1
    style PROD fill:#e1ffe1
```

## Best Practices

### 1. Branch Naming Convention

```
feature/descriptive-name
feat/descriptive-name
fix/descriptive-name
hotfix (untuk production fixes)
```

### 2. Commit Messages

```
feat: add user authentication
fix: resolve login validation issue
docs: update API documentation
refactor: improve code structure
test: add unit tests for auth module
```

### 3. Merge Strategy

- **Feature → Dev**: Squash and merge (optional)
- **Dev → Main**: Merge commit (ketika ingin deploy ke staging)
- **Dev → Training**: Merge commit (ketika ada keperluan training)
- **Hotfix → Prod-smile**: Merge commit

## Deployment Matrix

| Branch/Tag  | Server | Environment    | Auto Deploy                  | Purpose                              |
| ----------- | ------ | -------------- | ---------------------------- | ------------------------------------ |
| `dev`       | Badr   | Development    | ✅                           | Development testing                  |
| `main`      | AWS    | Staging/UAT    | ✅                           | Pre-production testing               |
| `training`  | AWS    | Training       | ✅                           | Training (shared app, separate data) |
| `release-*` | AWS    | Pre-production | ✅                           | Dry run, maintenance, migration      |
| `prod-*`    | AWS    | Production     | ❌ Auto CI but manual deploy | Live production                      |

## Referensi

- [Semantic Versioning](https://semver.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/)
