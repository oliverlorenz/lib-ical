#!/usr/bin/env bash
# Run once per repository (needs admin rights via `gh auth login`), after the
# template bootstrap commit has landed on main. Creates or updates the "main"
# ruleset: PRs only (squash), required checks "CI result" + "Validate PR title"
# from GitHub Actions, no force-push or deletion, repository admins may bypass.
#
# Usage: scripts/setup-ruleset.sh [owner/repo]   (defaults to the current repo)

set -euo pipefail

export REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
GITHUB_ACTIONS_APP_ID=15368
REPOSITORY_ADMIN_ROLE_ID=5

RULESET="$(cat <<JSON
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": ${REPOSITORY_ADMIN_ROLE_ID}, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "CI result", "integration_id": ${GITHUB_ACTIONS_APP_ID} },
          { "context": "Validate PR title", "integration_id": ${GITHUB_ACTIONS_APP_ID} }
        ]
      }
    }
  ]
}
JSON
)"

EXISTING_ID="$(gh api "repos/${REPO}/rulesets" --jq '.[] | select(.name == "main") | .id')"

if [ -n "$EXISTING_ID" ]; then
  echo "$RULESET" | gh api -X PUT "repos/${REPO}/rulesets/${EXISTING_ID}" --input - --jq '"Updated ruleset \(.id) on \(env.REPO)"'
else
  echo "$RULESET" | gh api -X POST "repos/${REPO}/rulesets" --input - --jq '"Created ruleset \(.id) on \(env.REPO)"'
fi

gh api -X PATCH "repos/${REPO}" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F allow_auto_merge=true -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
  --jq '"Repository merge settings updated for \(.full_name)"'
