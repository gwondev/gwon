# 작업 규칙 (모든 세션 공통)

## 코드 수정 흐름: 최신본 받기 → 수정 → push

여러 곳(Claude 세션, Cursor, 로컬 PC)에서 동시에 작업하므로, 코드 무결성을 위해 아래 순서를 반드시 지킨다.

1. **수정 전에 GitHub 최신본을 받는다**
   ```bash
   git fetch origin
   ```
   - 현재 브랜치의 원격본(`origin/<현재 브랜치>`)이 있으면 그 위로 맞춘다: `git pull --rebase origin <현재 브랜치>`
   - `origin/main`에 새 커밋이 있으면 그 위로 rebase 한다: `git rebase origin/main`
   - 충돌이 나면 임의로 덮어쓰지 말고 내용을 확인해서 해결하고, 판단이 어려우면 사용자에게 묻는다.

2. **수정한다**

3. **수정이 끝나면 바로 커밋하고 push 한다**
   - push 직전에 다시 `git fetch origin` 해서 그 사이 원격이 바뀌었으면 rebase 후 push 한다.
   - `git push -u origin <현재 브랜치>`
   - 수정 사항을 커밋/push 하지 않은 채로 작업을 끝내지 않는다. (클라우드 세션은 끝나면 사라진다.)

## 금지
- 다른 사람/다른 세션의 브랜치에 force push 하지 않는다.
- 원격 최신본을 확인하지 않고 오래된 코드 위에서 수정하지 않는다.
