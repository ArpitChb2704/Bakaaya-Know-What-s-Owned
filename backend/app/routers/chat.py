from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_active_plan
from app.database import get_db
from app.models import User, ChatLog
from app.schemas import ChatRequest, ChatResponse
from app.services.ai_chat import answer_question, NotLedgerQuestion

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def ask(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_plan),
):
    try:
        result = answer_question(db, current_user.id, payload.question)

    except NotLedgerQuestion as e:
        # Polite refusal — not an error, just out of scope
        return ChatResponse(answer=str(e), generated_sql=None)

    except Exception:
        # SQL failed or something unexpected — give a clean message,
        # never expose raw errors or SQL to the user
        return ChatResponse(
            answer=(
                "I wasn't able to answer that — the question might be too complex "
                "or the party name wasn't found. Try rephrasing, or check that "
                "the supplier/customer name is spelled the same way it was added."
            ),
            generated_sql=None,
        )

    # Log successful questions for debugging
    try:
        log = ChatLog(
            owner_id=current_user.id,
            question=payload.question,
            generated_sql=result.get("generated_sql"),
            answer=result.get("answer"),
        )
        db.add(log)
        db.commit()
    except Exception:
        pass  # logging failure should never break the response

    return ChatResponse(**result)
