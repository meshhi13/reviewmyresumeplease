FROM python:3.13-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        biber \
        fontconfig \
        fonts-font-awesome \
        fonts-inter \
        fonts-lato \
        fonts-noto-color-emoji \
        fonts-noto-core \
        fonts-noto-extra \
        fonts-noto-mono \
        fonts-open-sans \
        fonts-roboto \
        latexmk \
        texlive-bibtex-extra \
        texlive-font-utils \
        texlive-fonts-extra \
        texlive-fonts-recommended \
        texlive-humanities \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-latex-recommended \
        texlive-luatex \
        texlive-pictures \
        texlive-plain-generic \
        texlive-pstricks \
        texlive-publishers \
        texlive-science \
        texlive-xetex \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
