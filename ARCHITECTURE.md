# Architecture

The demo has one authentication module. `auth.py` owns the in-memory user records and credential comparison. Tests live in `tests/` and exercise the public `authenticate` function.
