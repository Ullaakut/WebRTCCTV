#!/bin/sh

set -x
set -eo pipefail

# Set default value of signaling URI if not in the environment
if [ -z "$SIGNALING_URI" ]; then
    echo "No signaling URI defined. Using 0.0.0.0 by default."
    export SIGNALING_URI=0.0.0.0
fi

envsubst < /usr/share/nginx/html/src/index_tmpl.js > /usr/share/nginx/html/src/index.js

/usr/sbin/nginx
