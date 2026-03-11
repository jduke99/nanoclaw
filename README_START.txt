 To restart the NanoClaw service, run:

    systemctl --user restart nanoclaw.service

    To check the status:
    systemctl --user status nanoclaw.service

    To view live logs:
    journalctl --user -u nanoclaw.service -f

    To stop it:
    systemctl --user stop nanoclaw.service

    To start it:
    systemctl --user start nanoclaw.service

    All of these commands run from your WSL2 terminal.

    
    B/c the env file is not loaded each time:
    1. Update the systemd service to automatically sync on restart
    2. Or always remember to run cp .env data/env/env before restarting

    For now, the pattern is:
    # Edit .env
    nano .env

    # Sync to container
    cp .env data/env/env

    # Restart
    systemctl --user restart nanoclaw.service