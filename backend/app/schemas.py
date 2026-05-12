from datetime import datetime
from typing import Any
import re

from pydantic import BaseModel, Field, field_validator


def clean_text(value: str) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value).strip()


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str

    model_config = {"from_attributes": True}


class UserProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)

    @field_validator("display_name")
    @classmethod
    def display_name_is_clean(cls, value: str | None) -> str:
        return clean_text(value or "")[:120]


class CommentCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    page: int = Field(ge=1)
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(ge=0.0, le=1.0)
    height: float = Field(ge=0.0, le=1.0)
    suggestion_start: int | None = Field(default=None, ge=0)
    suggestion_end: int | None = Field(default=None, ge=0)
    suggestion_original: str | None = Field(default=None, max_length=20_000)
    suggestion_replacement: str | None = Field(default=None, max_length=20_000)

    @field_validator("body", "suggestion_original", "suggestion_replacement")
    @classmethod
    def text_is_clean(cls, value: str | None) -> str | None:
        return clean_text(value) if value is not None else value


class CommentReplyCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def body_is_clean(cls, value: str) -> str:
        return clean_text(value)


class CommentReplyResponse(BaseModel):
    id: int
    comment_id: int
    author_id: int
    author_display_name: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentVoteRequest(BaseModel):
    vote: int = Field(ge=-1, le=1)  # 1 for upvote, -1 for downvote, 0 to remove vote


class CommentBulkResolveRequest(BaseModel):
    comment_ids: list[int] = Field(min_length=1, max_length=50)


class LatexCompileRequest(BaseModel):
    latex_source: str = Field(min_length=1, max_length=200_000)


class ResumeLatexSourceRequest(LatexCompileRequest):
    title: str | None = Field(default=None, max_length=255)

    @field_validator("title")
    @classmethod
    def title_is_clean(cls, value: str | None) -> str | None:
        return clean_text(value) if value is not None else value


class CommentResponse(BaseModel):
    id: int
    resume_id: int
    author_id: int
    author_display_name: str
    body: str
    page: int
    x: float
    y: float
    width: float
    height: float
    status: str
    created_at: datetime
    resolved_at: datetime | None
    resolved_by_display_name: str | None
    resolved_by_resume_id: int | None = None
    resolved_by_resume_title: str | None = None
    suggestion_start: int | None = None
    suggestion_end: int | None = None
    suggestion_original: str = ""
    suggestion_replacement: str = ""
    suggestion_status: str = "none"
    upvotes: int = 0
    downvotes: int = 0
    user_vote: int = 0
    replies: list[CommentReplyResponse] = []

    model_config = {"from_attributes": True}


class ResumeTitleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)

    @field_validator("title")
    @classmethod
    def title_is_clean(cls, value: str) -> str:
        return clean_text(value)


class ResumeLandedCompaniesRequest(BaseModel):
    landed_companies: list[str] = Field(default_factory=list, max_length=20)


class ResumeScoreRequest(BaseModel):
    score: int = Field(ge=0, le=100)


class ResumeScoreResponse(BaseModel):
    resume_id: int
    user_score: int
    aggregate_score: int
    score_count: int


class BrowseResumeResponse(BaseModel):
    id: int
    user_id: int
    title: str | None
    file_name: str
    source_format: str
    redactions: list[dict[str, Any]]
    landed_companies: list[str]
    anonymized: bool
    review_status: str
    notes: str
    created_at: datetime
    owner_display_name: str | None
    comment_count: int = 0
    open_comment_count: int
    downvote_count: int = 0
    aggregate_score: int = 0
    score_count: int = 0
    user_score: int | None = None

    model_config = {"from_attributes": True}


class ResumeResponse(BaseModel):
    id: int
    user_id: int
    title: str | None
    file_name: str
    source_format: str
    latex_source: str
    latex_source_hidden_for_privacy: bool = False
    redactions: list[dict[str, Any]]
    landed_companies: list[str]
    anonymized: bool
    review_status: str
    notes: str
    parent_resume_id: int | None = None
    resolves_comment_id: int | None = None
    fix_parent_resume_id: int | None = None
    fix_parent_resume_title: str | None = None
    fixes_comment_id: int | None = None
    created_at: datetime
    open_comment_count: int
    aggregate_score: int = 0
    score_count: int = 0
    user_score: int | None = None

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    id: int
    kind: str
    message: str
    target_url: str
    read: bool
    created_at: datetime
    actor_display_name: str | None = None

    model_config = {"from_attributes": True}
