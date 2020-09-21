#!/bin/sh +x

multilog_err=1
multilog_cmd="multilog s16777215 n10 '!tai64nlocal' /opt/orbs/logs"

while [[ "${multilog_err}" -ne "0" ]]; do
    sleep 1
    echo "rewards-distributor-v2 starting up.." | $multilog_cmd
    multilog_err=$?
done

echo "Running rewards-distributor-v2.."

npm start -- $@ 2>&1 | $multilog_cmd 2>&1
