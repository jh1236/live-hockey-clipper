FROM python:3.12-alpine

COPY requirements.txt requirements.txt
RUN pip install -U pip && pip install -r requirements.txt

COPY . /app
WORKDIR /app

EXPOSE 5000

RUN apk add ffmpeg

CMD ["gunicorn", "app:app", "--workers=4", "-b", "0.0.0.0:5000"]