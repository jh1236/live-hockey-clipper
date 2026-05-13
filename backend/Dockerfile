FROM python:3.12.8-slim

COPY requirements.txt requirements.txt
RUN pip install -U pip && pip install -r requirements.txt

COPY . .
WORKDIR /

EXPOSE 5000

CMD ["gunicorn", "app:app", "--workers=4", "-b", "0.0.0.0:5000"]