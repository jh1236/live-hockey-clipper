source ./.venv/bin/activate
source ./whistleiq.env
source ./livehockey.env

INITIAL_CHECK=false hypercorn app.py -b 0.0.0.0:5003