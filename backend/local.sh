source ./.venv/bin/activate
source ./whistleiq.env
source ./livehockey.env

CHECK_ALTIUS=false hypercorn app.py -b 0.0.0.0:5003