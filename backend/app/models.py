from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    resumes: Mapped[list["Resume"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    sessions: Mapped[list["SessionToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reviews: Mapped[list["Review"]] = relationship(back_populates="reviewer", cascade="all, delete-orphan")
    resume_scores: Mapped[list["ResumeScore"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    authored_comments: Mapped[list["Comment"]] = relationship(back_populates="author", foreign_keys="Comment.author_id", cascade="all, delete-orphan")
    resolved_comments: Mapped[list["Comment"]] = relationship(back_populates="resolved_by", foreign_keys="Comment.resolved_by_id")
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Notification.user_id",
    )


class SessionToken(Base):
    __tablename__ = "session_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/pdf")
    pdf_data: Mapped[bytes] = mapped_column(LargeBinary)
    source_format: Mapped[str] = mapped_column(String(40), default="pdf")
    latex_source: Mapped[str] = mapped_column(Text, default="")
    redactions: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    landed_companies: Mapped[list[str]] = mapped_column(JSONB, default=list)
    anonymized: Mapped[bool] = mapped_column(Boolean, default=False)
    review_status: Mapped[str] = mapped_column(String(80), default="ready_for_review")
    notes: Mapped[str] = mapped_column(Text, default="")
    parent_resume_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resolves_comment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped[User] = relationship(back_populates="resumes")
    reviews: Mapped[list["Review"]] = relationship(back_populates="resume", cascade="all, delete-orphan")
    scores: Mapped[list["ResumeScore"]] = relationship(back_populates="resume", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship(back_populates="resume", cascade="all, delete-orphan", order_by="Comment.created_at")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"), index=True)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    feedback: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    resume: Mapped["Resume"] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship(back_populates="reviews")


class ResumeScore(Base):
    __tablename__ = "resume_scores"
    __table_args__ = (UniqueConstraint("resume_id", "user_id", name="uq_resume_scores_resume_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    score: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    resume: Mapped["Resume"] = relationship(back_populates="scores")
    user: Mapped["User"] = relationship(back_populates="resume_scores")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    page: Mapped[int] = mapped_column(Integer)
    # Bounding box stored as fractions of page dimensions (0.0–1.0), scale-independent
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    width: Mapped[float] = mapped_column(Float)
    height: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="open")  # "open" | "resolved"
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_by_resume_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suggestion_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suggestion_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    suggestion_original: Mapped[str] = mapped_column(Text, default="")
    suggestion_replacement: Mapped[str] = mapped_column(Text, default="")
    suggestion_status: Mapped[str] = mapped_column(String(20), default="none")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    resume: Mapped["Resume"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(back_populates="authored_comments", foreign_keys=[author_id])
    resolved_by: Mapped["User | None"] = relationship(back_populates="resolved_comments", foreign_keys=[resolved_by_id])
    replies: Mapped[list["CommentReply"]] = relationship(back_populates="comment", cascade="all, delete-orphan", order_by="CommentReply.created_at")
    votes: Mapped[list["CommentVote"]] = relationship(back_populates="comment", cascade="all, delete-orphan")


class CommentReply(Base):
    __tablename__ = "comment_replies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    comment: Mapped["Comment"] = relationship(back_populates="replies")
    author: Mapped["User"] = relationship()


class CommentVote(Base):
    __tablename__ = "comment_votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    vote: Mapped[int] = mapped_column(Integer)  # +1 for upvote, -1 for downvote
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    comment: Mapped["Comment"] = relationship(back_populates="votes")
    user: Mapped["User"] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    kind: Mapped[str] = mapped_column(String(80))
    message: Mapped[str] = mapped_column(String(255))
    target_url: Mapped[str] = mapped_column(String(255))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="notifications", foreign_keys=[user_id])
    actor: Mapped[User | None] = relationship(foreign_keys=[actor_id])
