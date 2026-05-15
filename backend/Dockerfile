FROM python:3.12-alpine

COPY requirements.txt requirements.txt
RUN pip install -U pip && pip install -r requirements.txt

RUN apk add ffmpeg

COPY . /app
WORKDIR /app

EXPOSE 5000


CMD ["gunicorn", "app:app", "--workers=4", "-b", "0.0.0.0:5000"]