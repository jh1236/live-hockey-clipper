FROM python:3.12-alpine

COPY requirements.txt requirements.txt
RUN apk add ffmpeg


RUN pip install -U pip && pip install -r requirements.txt

COPY . /app
WORKDIR /app

EXPOSE 5000

ARG WORKERS=4
ENV WORKERS=$WORKERS
CMD hypercorn app:app --workers=$WORKERS -b 0.0.0.0:5000