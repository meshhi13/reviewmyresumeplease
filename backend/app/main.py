from datetime import datetime, timezone
from typing import Annotated
import base64
import secrets
import hashlib
import hmac
import json
import os
import re
import shutil
import subprocess
import tempfile

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.responses import Response
from sqlalchemy import select, text, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .database import Base, engine, get_db
from .models import Comment, Resume, SessionToken, User, Review, CommentReply, CommentVote, Notification
from .schemas import (
    AuthResponse,
    BrowseResumeResponse,
    CommentBulkResolveRequest,
    CommentCreateRequest,
    CommentResponse,
    CreateAccountRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResumeResponse,
    ResumeLandedCompaniesRequest,
    ResumeTitleRequest,
    NotificationResponse,
    ReviewCreateRequest,
    ReviewResponse,
    ResetPasswordRequest,
    SignInRequest,
    UserResponse,
    CommentReplyCreateRequest,
    CommentVoteRequest,
    LatexCompileRequest,
    ResumeLatexSourceRequest,
)

app = FastAPI(title="Resume Review Platform API")
Instrumentator().instrument(app).expose(app)

FAANG_PLUS_COMPANIES = [
    "Meta",
    "Apple",
    "Amazon",
    "Netflix",
    "Google",
    "Microsoft",
    "OpenAI",
    "NVIDIA",
    "Tesla",
    "Uber",
    "Airbnb",
    "Stripe",
    "Databricks",
    "Snowflake",
    "Salesforce",
    "Adobe",
    "LinkedIn",
    "Palantir",
    "Bloomberg",
]

allowed_origins = os.environ["ALLOWED_ORIGINS"].split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Handle race conditions where multiple workers try to create tables at once
        pass
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
        connection.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS title VARCHAR(255)"))
        connection.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS source_format VARCHAR(40) NOT NULL DEFAULT 'pdf'"))
        connection.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS latex_source TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS landed_companies JSONB NOT NULL DEFAULT '[]'::jsonb"))
        connection.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resolves_comment_id INTEGER"))
        connection.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS resolved_by_resume_id INTEGER"))
        connection.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS suggestion_start INTEGER"))
        connection.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS suggestion_end INTEGER"))
        connection.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS suggestion_original TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS suggestion_replacement TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS suggestion_status VARCHAR(20) NOT NULL DEFAULT 'none'"))
        connection.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id INTEGER"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/companies/faang-plus")
def list_faang_plus_companies() -> dict[str, list[str]]:
    return {"companies": FAANG_PLUS_COMPANIES}


# ─── Auth ────────────────────────────────────────────────────────────────────

@app.post("/auth/create-account", response_model=AuthResponse)
def create_account(payload: CreateAccountRequest, db: Annotated[Session, Depends(get_db)]) -> dict:
    email = payload.email.lower().strip()
    display_name = (payload.display_name or "").strip() or name_from_email(email)
    user = db.scalar(select(User).where(User.email == email))

    if user and user.password_hash:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    if user:
        user.display_name = display_name
        user.password_hash = hash_password(payload.password)
    else:
        user = User(email=email, display_name=display_name, password_hash=hash_password(payload.password))
        db.add(user)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="An account with this email already exists")

    return create_session_response(user, db)


@app.post("/auth/sign-in", response_model=AuthResponse)
def sign_in(payload: SignInRequest, db: Annotated[Session, Depends(get_db)]) -> dict:
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return create_session_response(user, db)


@app.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Annotated[Session, Depends(get_db)]) -> dict:
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    response = {"message": "If an account exists, a reset link is ready."}
    if user and user.password_hash:
        response["reset_token"] = create_password_reset_token(email)
    return response


@app.post("/auth/reset-password", response_model=AuthResponse)
def reset_password(payload: ResetPasswordRequest, db: Annotated[Session, Depends(get_db)]) -> dict:
    email = verify_password_reset_token(payload.reset_token)
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(user)
    return create_session_response(user, db)


def create_session_response(user: User, db: Session) -> dict:
    token = secrets.token_urlsafe(32)
    session = SessionToken(user_id=user.id, token=token)
    db.add(session)
    db.commit()
    db.refresh(user)
    return {"user": user, "token": token}


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")
    token = authorization.removeprefix("Bearer ").strip()
    session = db.scalar(select(SessionToken).where(SessionToken.token == token))
    if not session:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return user


@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


# ─── LaTeX ───────────────────────────────────────────────────────────────────

@app.post("/latex/compile")
def compile_latex_preview(
    payload: LatexCompileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    pdf_data = compile_latex_to_pdf(payload.latex_source)
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Cache-Control": "no-store"},
    )


# ─── Notifications ──────────────────────────────────────────────────────────

@app.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    notifications = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .options(selectinload(Notification.actor))
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(30)
        )
    )
    return [_notification_dict(n) for n in notifications]


@app.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    notification = db.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read = True
    db.commit()
    db.refresh(notification)
    return _notification_dict(notification)


# ─── Browse ──────────────────────────────────────────────────────────────────

@app.get("/resumes/browse", response_model=list[BrowseResumeResponse])
def browse_resumes(
    status: str | None = None,
    search: str | None = None,
    company: str | None = None,
    sort: str = "downvotes",
    db: Annotated[Session, Depends(get_db)] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> list[dict]:
    query = (
        select(Resume)
        .where(Resume.anonymized.is_(False))
        .options(selectinload(Resume.owner), selectinload(Resume.comments).selectinload(Comment.votes))
    )
    if search:
        term = f"%{search.lower()}%"
        query = query.where(
            Resume.title.ilike(term) | Resume.file_name.ilike(term)
        )
    query = query.order_by(Resume.created_at.desc(), Resume.id.desc())

    resumes = list(db.scalars(query))
    if company:
        company_filter = normalize_landed_company(company).lower()
        resumes = [
            r for r in resumes
            if any(saved_company.lower() == company_filter for saved_company in (r.landed_companies or []))
        ]
    if sort == "downvotes":
        resumes.sort(key=resume_downvote_score, reverse=True)
    elif sort == "popular":
        resumes.sort(key=resume_activity_score, reverse=True)
    elif sort == "date_asc":
        resumes.sort(key=lambda r: (r.created_at, r.id))
    elif sort == "name":
        resumes.sort(key=lambda r: ((r.title or r.file_name).lower(), r.id))
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "title": r.title,
            "file_name": r.file_name,
            "source_format": r.source_format,
            "redactions": r.redactions,
            "landed_companies": r.landed_companies or [],
            "anonymized": r.anonymized,
            "review_status": r.review_status,
            "notes": r.notes,
            "created_at": r.created_at,
            "owner_display_name": r.owner.display_name,
            "comment_count": len(r.comments or []),
            "open_comment_count": sum(1 for c in r.comments if c.status == "open"),
            "downvote_count": sum(1 for c in (r.comments or []) for v in c.votes if v.vote == -1),
        }
        for r in resumes
    ]


# ─── Resumes ─────────────────────────────────────────────────────────────────

@app.get("/users/{user_id}/resumes", response_model=list[ResumeResponse])
def list_resumes(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only view your own resumes")
    resumes = list(
        db.scalars(
            select(Resume)
            .where(Resume.user_id == user_id)
            .options(selectinload(Resume.comments))
            .order_by(Resume.created_at.desc(), Resume.id.desc())
        )
    )
    title_by_resume_id = {r.id: r.title or r.file_name for r in resumes}
    fix_parent_by_child_id: dict[int, dict[str, int | str]] = {}
    for parent in resumes:
        for comment in parent.comments or []:
            if comment.resolved_by_resume_id:
                fix_parent_by_child_id[comment.resolved_by_resume_id] = {
                    "resume_id": parent.id,
                    "resume_title": title_by_resume_id[parent.id],
                    "comment_id": comment.id,
                }

    response = []
    for resume in resumes:
        item = _resume_dict(resume)
        parent = fix_parent_by_child_id.get(resume.id)
        if parent:
            item["fix_parent_resume_id"] = parent["resume_id"]
            item["fix_parent_resume_title"] = parent["resume_title"]
            item["fixes_comment_id"] = parent["comment_id"]
        response.append(item)
    return response


@app.post("/users/{user_id}/resumes", response_model=ResumeResponse)
async def save_resume(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile | None = File(None),
    redactions: str = Form("[]"),
    anonymized: bool = Form(False),
    notes: str = Form(""),
    title: str = Form(""),
    latex_source: str = Form(""),
    landed_companies: str = Form("[]"),
    resolves_comment_id: int | None = Form(None),
) -> dict:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only save resumes to your own profile")
    try:
        parsed_redactions = json.loads(redactions)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid redactions JSON") from exc
    if not isinstance(parsed_redactions, list):
        raise HTTPException(status_code=400, detail="Redactions must be a list")
    try:
        parsed_companies = json.loads(landed_companies)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid landed companies JSON") from exc
    if not isinstance(parsed_companies, list):
        raise HTTPException(status_code=400, detail="Landed companies must be a list")
    validated_companies = validate_landed_companies(parsed_companies)

    source = latex_source.strip()
    source_format = "latex" if source else "pdf"
    file_name = "resume.pdf"
    content_type = "application/pdf"

    if source:
        pdf_data = compile_latex_to_pdf(source)
        file_name = f"{(title.strip() or 'resume')}.pdf"
    elif file:
        raw_file = await file.read()
        if file.filename and file.filename.lower().endswith(".tex"):
            source = raw_file.decode("utf-8", errors="replace")
            source_format = "latex"
            pdf_data = compile_latex_to_pdf(source)
            file_name = file.filename.removesuffix(".tex") + ".pdf"
        else:
            if file.content_type != "application/pdf":
                raise HTTPException(status_code=400, detail="Upload a LaTeX source file or PDF")
            pdf_data = raw_file
            file_name = file.filename or "resume.pdf"
    else:
        raise HTTPException(status_code=400, detail="Provide LaTeX source or a resume file")

    resume = Resume(
        user_id=current_user.id,
        title=title.strip() or None,
        file_name=file_name,
        content_type=content_type,
        pdf_data=pdf_data,
        source_format=source_format,
        latex_source=source,
        redactions=parsed_redactions,
        landed_companies=validated_companies,
        anonymized=anonymized,
        notes=notes.strip(),
        resolves_comment_id=resolves_comment_id,
    )
    db.add(resume)
    db.flush()  # get resume.id

    # If this resume resolves a comment, link the comment back to this resume
    if resolves_comment_id:
        comment = db.get(Comment, resolves_comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="Issue not found")
        original_resume = db.get(Resume, comment.resume_id)
        if not original_resume or original_resume.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only upload fixes for issues on your own resumes")
        if comment.status != "open":
            raise HTTPException(status_code=400, detail="This issue is already resolved")
        comment.resolved_by_resume_id = resume.id
        create_notification(
            db,
            user_id=comment.author_id,
            actor_id=current_user.id,
            kind="fix_uploaded",
            message=f"{current_user.display_name} uploaded a resume revision for your issue",
            target_url=f"/resume/{original_resume.id}",
        )

    db.commit()
    db.refresh(resume)
    # reload comments (empty on creation)
    db.refresh(resume, ["comments"])
    can_include_source = resume.user_id == current_user.id or (not resume.anonymized and not (resume.redactions or []))
    return _resume_dict(resume, include_latex_source=can_include_source)


@app.get("/resumes/{resume_id}/file")
def get_resume_file(
    resume_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not can_view_resume(resume, current_user, db):
        raise HTTPException(status_code=403, detail="Resume not available for review")
    safe_file_name = resume.file_name.replace('"', "")
    return Response(
        content=resume.pdf_data,
        media_type=resume.content_type,
        headers={
            "Content-Disposition": f'inline; filename="{safe_file_name}"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/resumes/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.scalar(
        select(Resume).where(Resume.id == resume_id).options(selectinload(Resume.comments))
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not can_view_resume(resume, current_user, db):
        raise HTTPException(status_code=403, detail="Resume not available")
    can_include_source = resume.user_id == current_user.id or (not resume.anonymized and not (resume.redactions or []))
    return _resume_dict(resume, include_latex_source=can_include_source)


@app.patch("/resumes/{resume_id}/anonymized")
def update_resume_anonymized(
    resume_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own resumes")
    resume.anonymized = not resume.anonymized
    db.commit()
    return {"id": resume.id, "anonymized": resume.anonymized}


@app.patch("/resumes/{resume_id}/title")
def update_resume_title(
    resume_id: int,
    payload: ResumeTitleRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only rename your own resumes")
    resume.title = payload.title.strip()
    db.commit()
    return {"id": resume.id, "title": resume.title}


@app.patch("/resumes/{resume_id}/latex-source", response_model=ResumeResponse)
def update_resume_latex_source(
    resume_id: int,
    payload: ResumeLatexSourceRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.scalar(
        select(Resume).where(Resume.id == resume_id).options(selectinload(Resume.comments))
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own resumes")
    resume.latex_source = payload.latex_source.strip()
    resume.source_format = "latex"
    resume.pdf_data = compile_latex_to_pdf(resume.latex_source)
    resume.content_type = "application/pdf"
    if payload.title is not None:
        resume.title = payload.title.strip() or resume.title
    db.commit()
    db.refresh(resume)
    return _resume_dict(resume)


@app.patch("/resumes/{resume_id}/landed-companies", response_model=ResumeResponse)
def update_resume_landed_companies(
    resume_id: int,
    payload: ResumeLandedCompaniesRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.scalar(
        select(Resume).where(Resume.id == resume_id).options(selectinload(Resume.comments))
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own resumes")
    resume.landed_companies = validate_landed_companies(payload.landed_companies)
    db.commit()
    db.refresh(resume)
    return _resume_dict(resume)


@app.delete("/resumes/{resume_id}", status_code=204)
def delete_resume(
    resume_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own resumes")
    db.delete(resume)
    db.commit()


@app.patch("/resumes/{resume_id}/resubmit")
def resubmit_resume(
    resume_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only resubmit your own resumes")
    resume.review_status = "ready_for_review"
    db.commit()
    return {"id": resume.id, "review_status": resume.review_status}


# ─── Comments ────────────────────────────────────────────────────────────────

@app.post("/resumes/{resume_id}/comments", response_model=CommentResponse)
def create_comment(
    resume_id: int,
    payload: CommentCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    suggestion_start = payload.suggestion_start
    suggestion_end = payload.suggestion_end
    suggestion_original = (payload.suggestion_original or "")
    suggestion_replacement = (payload.suggestion_replacement or "")
    suggestion_status = "none"
    if any(value is not None and value != "" for value in [suggestion_start, suggestion_end, suggestion_original, suggestion_replacement]):
        if resume.source_format != "latex" or not resume.latex_source:
            raise HTTPException(status_code=400, detail="Suggestions can only be added to LaTeX resumes")
        if (suggestion_start is None) != (suggestion_end is None):
            raise HTTPException(status_code=400, detail="Invalid suggestion range")
        if suggestion_start is not None and suggestion_end is not None:
            if suggestion_end < suggestion_start:
                raise HTTPException(status_code=400, detail="Invalid LaTeX suggestion range")
            if suggestion_end > len(resume.latex_source):
                raise HTTPException(status_code=400, detail="LaTeX suggestion range is outside the source")
            if resume.latex_source[suggestion_start:suggestion_end] != suggestion_original:
                raise HTTPException(status_code=409, detail="Selected LaTeX source no longer matches this resume")
        elif find_visible_text_span(resume.latex_source, suggestion_original) is None:
            raise HTTPException(status_code=409, detail="Selected resume text no longer matches this resume")
        if not suggestion_replacement.strip():
            raise HTTPException(status_code=400, detail="Suggested replacement cannot be empty")
        suggestion_status = "pending"
    comment = Comment(
        resume_id=resume_id,
        author_id=current_user.id,
        body=payload.body.strip(),
        page=payload.page,
        x=payload.x,
        y=payload.y,
        width=payload.width,
        height=payload.height,
        status="open",
        suggestion_start=suggestion_start,
        suggestion_end=suggestion_end,
        suggestion_original=suggestion_original,
        suggestion_replacement=suggestion_replacement,
        suggestion_status=suggestion_status,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    create_notification(
        db,
        user_id=resume.user_id,
        actor_id=current_user.id,
        kind="issue_opened",
        message=f"{current_user.display_name} opened an issue on your resume",
        target_url=f"/resume/{resume.id}",
    )
    db.commit()
    return _comment_dict(comment, current_user.display_name, None, current_user.id)


@app.get("/resumes/{resume_id}/comments", response_model=list[CommentResponse])
def list_comments(
    resume_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    # Owner sees all comments; public resumes also show all comments.
    # Otherwise, reviewers see only their own.
    comments = list(
        db.scalars(
            select(Comment)
            .where(Comment.resume_id == resume_id)
            .options(
                selectinload(Comment.author), 
                selectinload(Comment.resolved_by),
                selectinload(Comment.replies).selectinload(CommentReply.author),
                selectinload(Comment.votes)
            )
            .order_by(Comment.created_at.asc())
        )
    )
    if resume.user_id != current_user.id and resume.anonymized:
        comments = [c for c in comments if c.author_id == current_user.id]
    linked_resume_titles = get_linked_resume_titles(db, comments)
    return [
        _comment_dict(
            c,
            c.author.display_name,
            c.resolved_by.display_name if c.resolved_by else None,
            current_user.id,
            linked_resume_titles.get(c.resolved_by_resume_id) if c.resolved_by_resume_id else None,
        )
        for c in comments
    ]


@app.patch("/resumes/{resume_id}/comments/{comment_id}/resolve", response_model=CommentResponse)
def resolve_comment(
    resume_id: int,
    comment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    comment = db.scalar(
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.author), selectinload(Comment.resolved_by), selectinload(Comment.replies).selectinload(CommentReply.author), selectinload(Comment.votes))
    )
    if not comment or comment.resume_id != resume_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the issue author can resolve this issue")
    if not comment.resolved_by_resume_id and comment.suggestion_status != "applied":
        raise HTTPException(status_code=400, detail="A linked resume revision or applied LaTeX suggestion is required before resolving this issue")
    comment.status = "resolved"
    comment.resolved_at = datetime.now(timezone.utc)
    comment.resolved_by_id = current_user.id
    create_notification(
        db,
        user_id=resume.user_id,
        actor_id=current_user.id,
        kind="issue_resolved",
        message=f"{current_user.display_name} resolved an issue after reviewing your revision",
        target_url=f"/resume/{resume.id}",
    )
    db.commit()
    db.refresh(comment)
    linked_title = get_linked_resume_titles(db, [comment]).get(comment.resolved_by_resume_id)
    return _comment_dict(comment, comment.author.display_name, current_user.display_name, current_user.id, linked_title)


@app.patch("/resumes/{resume_id}/comments/resolve", response_model=list[CommentResponse])
def resolve_comments_bulk(
    resume_id: int,
    payload: CommentBulkResolveRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    requested_ids = set(payload.comment_ids)
    comments = list(
        db.scalars(
            select(Comment)
            .where(Comment.resume_id == resume_id, Comment.id.in_(requested_ids))
            .options(
                selectinload(Comment.author),
                selectinload(Comment.resolved_by),
                selectinload(Comment.replies).selectinload(CommentReply.author),
                selectinload(Comment.votes),
            )
            .order_by(Comment.created_at.asc())
        )
    )
    if len(comments) != len(requested_ids):
        raise HTTPException(status_code=404, detail="One or more comments were not found")
    for comment in comments:
        if comment.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only issue authors can resolve their issues")
        if not comment.resolved_by_resume_id and comment.suggestion_status != "applied":
            raise HTTPException(status_code=400, detail="Every issue needs a linked resume revision or applied LaTeX suggestion before resolving")

    now = datetime.now(timezone.utc)
    changed = []
    for comment in comments:
        if comment.status != "resolved":
            comment.status = "resolved"
            comment.resolved_at = now
            comment.resolved_by_id = current_user.id
            changed.append(comment)

    if changed:
        noun = "issue" if len(changed) == 1 else "issues"
        create_notification(
            db,
            user_id=resume.user_id,
            actor_id=current_user.id,
            kind="issue_resolved",
            message=f"{current_user.display_name} resolved {len(changed)} {noun} after reviewing your revision",
            target_url=f"/resume/{resume.id}",
        )

    db.commit()
    for comment in comments:
        db.refresh(comment)
    linked_titles = get_linked_resume_titles(db, comments)
    return [
        _comment_dict(
            comment,
            comment.author.display_name,
            current_user.display_name,
            current_user.id,
            linked_titles.get(comment.resolved_by_resume_id) if comment.resolved_by_resume_id else None,
        )
        for comment in comments
    ]


@app.patch("/resumes/{resume_id}/comments/{comment_id}/suggestion/apply", response_model=CommentResponse)
def apply_comment_suggestion(
    resume_id: int,
    comment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.scalar(
        select(Resume).where(Resume.id == resume_id).options(selectinload(Resume.comments))
    )
    comment = db.scalar(
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.author), selectinload(Comment.resolved_by), selectinload(Comment.replies).selectinload(CommentReply.author), selectinload(Comment.votes))
    )
    if not resume or not comment or comment.resume_id != resume_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the resume owner can apply suggestions")
    if comment.suggestion_status != "pending":
        raise HTTPException(status_code=400, detail="This suggestion is not pending")
    if comment.suggestion_start is None or comment.suggestion_end is None:
        span = find_visible_text_span(resume.latex_source, comment.suggestion_original)
        if span is None:
            raise HTTPException(status_code=409, detail="This suggestion no longer matches the current resume source")
        start, end = span
        resume.latex_source = resume.latex_source[:start] + comment.suggestion_replacement + resume.latex_source[end:]
    else:
        if resume.latex_source[comment.suggestion_start:comment.suggestion_end] != comment.suggestion_original:
            raise HTTPException(status_code=409, detail="This suggestion no longer matches the current LaTeX source")
        resume.latex_source = (
            resume.latex_source[:comment.suggestion_start]
            + comment.suggestion_replacement
            + resume.latex_source[comment.suggestion_end:]
        )
    resume.source_format = "latex"
    resume.pdf_data = compile_latex_to_pdf(resume.latex_source)
    resume.content_type = "application/pdf"
    comment.suggestion_status = "applied"
    create_notification(
        db,
        user_id=comment.author_id,
        actor_id=current_user.id,
        kind="suggestion_applied",
        message=f"{current_user.display_name} applied your resume text suggestion",
        target_url=f"/resume/{resume.id}",
    )
    db.commit()
    db.refresh(comment)
    return _comment_dict(comment, comment.author.display_name, comment.resolved_by.display_name if comment.resolved_by else None, current_user.id)


@app.patch("/resumes/{resume_id}/comments/{comment_id}/suggestion/reject", response_model=CommentResponse)
def reject_comment_suggestion(
    resume_id: int,
    comment_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    comment = db.scalar(
        select(Comment)
        .where(Comment.id == comment_id)
        .options(selectinload(Comment.author), selectinload(Comment.resolved_by), selectinload(Comment.replies).selectinload(CommentReply.author), selectinload(Comment.votes))
    )
    if not resume or not comment or comment.resume_id != resume_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if resume.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the resume owner can reject suggestions")
    if comment.suggestion_status != "pending":
        raise HTTPException(status_code=400, detail="This suggestion is not pending")
    comment.suggestion_status = "rejected"
    create_notification(
        db,
        user_id=comment.author_id,
        actor_id=current_user.id,
        kind="suggestion_rejected",
        message=f"{current_user.display_name} rejected your LaTeX suggestion",
        target_url=f"/resume/{resume.id}",
    )
    db.commit()
    db.refresh(comment)
    return _comment_dict(comment, comment.author.display_name, comment.resolved_by.display_name if comment.resolved_by else None, current_user.id)

@app.post("/resumes/{resume_id}/comments/{comment_id}/replies")
def create_reply(
    resume_id: int,
    comment_id: int,
    payload: CommentReplyCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    comment = db.get(Comment, comment_id)
    if not resume or not comment or comment.resume_id != resume_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if resume.user_id != current_user.id and resume.anonymized:
        raise HTTPException(status_code=403, detail="Cannot reply to a private resume")

    reply = CommentReply(
        comment_id=comment_id,
        author_id=current_user.id,
        body=payload.body.strip(),
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    recipients = {comment.author_id, resume.user_id}
    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            actor_id=current_user.id,
            kind="issue_reply",
            message=f"{current_user.display_name} replied on a resume issue",
            target_url=f"/resume/{resume.id}",
        )
    db.commit()
    return {
        "id": reply.id, "comment_id": reply.comment_id, "author_id": reply.author_id,
        "author_display_name": current_user.display_name, "body": reply.body,
        "created_at": reply.created_at
    }


@app.post("/resumes/{resume_id}/comments/{comment_id}/vote")
def vote_comment(
    resume_id: int,
    comment_id: int,
    payload: CommentVoteRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    comment = db.get(Comment, comment_id)
    if not resume or not comment or comment.resume_id != resume_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if resume.user_id != current_user.id and resume.anonymized:
        raise HTTPException(status_code=403, detail="Cannot vote on a private resume")

    vote = db.scalar(select(CommentVote).where(CommentVote.comment_id == comment_id, CommentVote.user_id == current_user.id))
    
    if payload.vote == 0:
        if vote:
            db.delete(vote)
    else:
        if vote:
            vote.vote = payload.vote
        else:
            vote = CommentVote(comment_id=comment_id, user_id=current_user.id, vote=payload.vote)
            db.add(vote)
            
    db.commit()

    db.refresh(comment)
    downvotes = sum(1 for v in comment.votes if v.vote == -1)
    if downvotes >= 5:
        db.delete(comment)
        db.commit()
        return {"deleted": True}
    
    # Reload author and resolved_by for the response
    return {"deleted": False, "comment": _comment_dict(comment, comment.author.display_name, comment.resolved_by.display_name if comment.resolved_by else None, current_user.id)}


# ─── Legacy reviews (kept for back-compat) ───────────────────────────────────

@app.post("/resumes/{resume_id}/reviews", response_model=ReviewResponse)
def create_review(
    resume_id: int,
    payload: ReviewCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    resume = db.get(Resume, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if resume.user_id == current_user.id:
        raise HTTPException(status_code=403, detail="You cannot review your own resume")
    if resume.review_status != "ready_for_review":
        raise HTTPException(status_code=400, detail="Resume is not open for review")
    review = Review(resume_id=resume.id, reviewer_id=current_user.id, rating=payload.rating, feedback=payload.feedback.strip())
    db.add(review)
    db.commit()
    db.refresh(review)
    return {"id": review.id, "resume_id": review.resume_id, "reviewer_id": review.reviewer_id,
            "reviewer_display_name": current_user.display_name, "rating": review.rating,
            "feedback": review.feedback, "created_at": review.created_at}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def can_view_resume(resume: Resume, user: User, db: Session) -> bool:
    if resume.user_id == user.id:
        return True
    linked_issue = db.scalar(
        select(Comment.id).where(
            Comment.author_id == user.id,
            Comment.resolved_by_resume_id == resume.id,
        )
    )
    if linked_issue:
        return True
    return not resume.anonymized and resume.review_status == "ready_for_review"


def resume_activity_score(resume: Resume) -> tuple[int, int, datetime, int]:
    comments = resume.comments or []
    open_count = sum(1 for c in comments if c.status == "open")
    suggestion_count = sum(1 for c in comments if getattr(c, "suggestion_status", "none") != "none")
    return (len(comments), open_count + suggestion_count, resume.created_at, resume.id)


def resume_downvote_score(resume: Resume) -> tuple[int, int, datetime, int]:
    comments = resume.comments or []
    downvotes = sum(1 for c in comments for v in c.votes if v.vote == -1)
    return (downvotes, len(comments), resume.created_at, resume.id)


def find_visible_text_span(source: str, visible_text: str) -> tuple[int, int] | None:
    normalized = " ".join(visible_text.split())
    if not normalized:
        return None
    exact = source.find(visible_text)
    if exact >= 0:
        return exact, exact + len(visible_text)
    tokens = normalized.split()
    pattern = r"\s+".join(re.escape(token) for token in tokens)
    match = re.search(pattern, source)
    if not match:
        return None
    return match.start(), match.end()


def _resume_dict(r: Resume, include_latex_source: bool = True) -> dict:
    open_count = sum(1 for c in r.comments if c.status == "open")
    return {
        "id": r.id, "user_id": r.user_id, "title": r.title, "file_name": r.file_name,
        "source_format": r.source_format, "latex_source": (r.latex_source or "") if include_latex_source else "",
        "latex_source_hidden_for_privacy": bool((r.latex_source or "") and not include_latex_source),
        "redactions": r.redactions, "landed_companies": r.landed_companies or [],
        "anonymized": r.anonymized,
        "review_status": r.review_status, "notes": r.notes,
        "resolves_comment_id": r.resolves_comment_id,
        "created_at": r.created_at, "open_comment_count": open_count,
    }


def compile_latex_to_pdf(source: str) -> bytes:
    engine_name = choose_latex_engine(source)
    compiler = shutil.which(engine_name)
    if not compiler:
        raise HTTPException(
            status_code=503,
            detail=f"{engine_name} is not installed on the backend. Rebuild the backend image to enable LaTeX editing.",
        )
    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = os.path.join(tmpdir, "resume.tex")
        with open(source_path, "w", encoding="utf-8") as source_file:
            source_file.write(source)
        command = [
            compiler,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-no-shell-escape",
            "resume.tex",
        ]
        try:
            completed = subprocess.run(
                command,
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=12,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=400, detail="LaTeX compilation timed out") from exc
        pdf_path = os.path.join(tmpdir, "resume.pdf")
        if completed.returncode != 0 or not os.path.exists(pdf_path):
            log = (completed.stdout + "\n" + completed.stderr).strip()
            raise HTTPException(status_code=400, detail=f"LaTeX compilation failed:\n{log[-3000:]}")
        with open(pdf_path, "rb") as pdf_file:
            return pdf_file.read()


def choose_latex_engine(source: str) -> str:
    lower_source = source.lower()
    first_lines = "\n".join(source.splitlines()[:5]).lower()
    if "program = lualatex" in first_lines or "ts-program = lualatex" in first_lines:
        return "lualatex"
    if (
        "program = xelatex" in first_lines
        or "ts-program = xelatex" in first_lines
        or "\\usepackage{fontspec}" in lower_source
        or "\\usepackage[" in lower_source and "]{fontspec}" in lower_source
        or "\\setmainfont" in lower_source
        or "\\setsansfont" in lower_source
        or "\\setmonofont" in lower_source
    ):
        return "xelatex"
    return "pdflatex"


def validate_landed_companies(companies: list) -> list[str]:
    normalized: list[str] = []
    for company in companies:
        match = normalize_landed_company(company)
        if match and match.lower() not in {existing.lower() for existing in normalized}:
            normalized.append(match)
    return normalized


def normalize_landed_company(company: str) -> str:
    if not isinstance(company, str):
        raise HTTPException(status_code=400, detail="Landed companies must be strings")
    trimmed = " ".join(company.strip().split())
    if not trimmed:
        return ""
    if len(trimmed) > 80:
        raise HTTPException(status_code=400, detail="Landed company names must be 80 characters or fewer")
    allowed = {known.lower(): known for known in FAANG_PLUS_COMPANIES}
    return allowed.get(trimmed.lower(), trimmed)


def _notification_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "kind": n.kind,
        "message": n.message,
        "target_url": n.target_url,
        "read": n.read,
        "created_at": n.created_at,
        "actor_display_name": n.actor.display_name if n.actor else None,
    }


def create_notification(db: Session, user_id: int, actor_id: int | None, kind: str, message: str, target_url: str) -> None:
    if actor_id and user_id == actor_id:
        return
    db.add(Notification(user_id=user_id, actor_id=actor_id, kind=kind, message=message, target_url=target_url))


def get_linked_resume_titles(db: Session, comments: list[Comment]) -> dict[int, str]:
    resume_ids = sorted({c.resolved_by_resume_id for c in comments if c.resolved_by_resume_id})
    if not resume_ids:
        return {}
    resumes = db.scalars(select(Resume).where(Resume.id.in_(resume_ids)))
    return {r.id: r.title or r.file_name for r in resumes}


def _comment_dict(
    c: Comment,
    author_name: str,
    resolved_by_name: str | None = None,
    current_user_id: int | None = None,
    resolved_by_resume_title: str | None = None,
) -> dict:
    upvotes = sum(1 for v in c.votes if v.vote == 1)
    downvotes = sum(1 for v in c.votes if v.vote == -1)
    user_vote = next((v.vote for v in c.votes if v.user_id == current_user_id), 0) if current_user_id else 0

    return {
        "id": c.id, "resume_id": c.resume_id, "author_id": c.author_id,
        "author_display_name": author_name, "body": c.body,
        "page": c.page, "x": c.x, "y": c.y, "width": c.width, "height": c.height,
        "status": c.status, "created_at": c.created_at,
        "resolved_at": c.resolved_at, "resolved_by_display_name": resolved_by_name,
        "resolved_by_resume_id": c.resolved_by_resume_id,
        "resolved_by_resume_title": resolved_by_resume_title,
        "suggestion_start": getattr(c, "suggestion_start", None),
        "suggestion_end": getattr(c, "suggestion_end", None),
        "suggestion_original": getattr(c, "suggestion_original", "") or "",
        "suggestion_replacement": getattr(c, "suggestion_replacement", "") or "",
        "suggestion_status": getattr(c, "suggestion_status", "none") or "none",
        "upvotes": upvotes, "downvotes": downvotes, "user_vote": user_vote,
        "replies": [
            {
                "id": r.id,
                "comment_id": r.comment_id,
                "author_id": r.author_id,
                "author_display_name": r.author.display_name if r.author else "Unknown",
                "body": r.body,
                "created_at": r.created_at,
            }
            for r in c.replies
        ]
    }


def hash_password(password: str) -> str:
    iterations = 210_000
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
    return hmac.compare_digest(digest.hex(), expected)


def create_password_reset_token(email: str) -> str:
    expires_at = int(datetime.now(timezone.utc).timestamp()) + 3600
    payload = f"{email}|{expires_at}|{secrets.token_urlsafe(12)}"
    payload_token = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    signature = hmac.new(password_reset_secret().encode(), payload_token.encode(), hashlib.sha256).hexdigest()
    return f"{payload_token}.{signature}"


def verify_password_reset_token(token: str) -> str:
    try:
        payload_token, signature = token.split(".", 1)
        expected_signature = hmac.new(password_reset_secret().encode(), payload_token.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError
        padding = "=" * (-len(payload_token) % 4)
        payload = base64.urlsafe_b64decode(f"{payload_token}{padding}").decode()
        email, expires_at, _nonce = payload.split("|", 2)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if int(expires_at) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    return email.lower().strip()


def password_reset_secret() -> str:
    return os.environ["PASSWORD_RESET_SECRET"]


def name_from_email(email: str) -> str:
    return email.split("@")[0].replace(".", " ").replace("_", " ").title()
