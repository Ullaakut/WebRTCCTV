#!/usr/bin/env bash

# VARIABLE INITIALIZATION

set -e
set -x

usage() {
    echo "Usage: $(basename "$0") [-h] -c CLOUD_SSH_ADDR -u CLOUD_SSH_USER -a MEDIA_SERV_SSH_ADDR -m MEDIA_SERV_SSH_USER
This script is used to deploy the WebRTCCTV in a cloud environment, using the first server 'MEDIA_SERV' as a media server and a the 'CLOUD' as the server that serves the web application, the signaling server and the TURN server.

    -h  shows this help text
    -c  set cloud SSH address
    -u  set cloud SSH user
    -a  set media server SSH address
    -m  set media server SSH user" >&2
}

# COMMAND LINE PARSING

while getopts ':hb:u:c:v:' option; do
    case "$option" in
        h) usage
           exit
           ;;
        c) CLOUD_SSH_ADDR=${OPTARG}
           ;;
        u) CLOUD_SSH_USER=${OPTARG}
           ;;
        a) MEDIA_SERV_SSH_ADDR=${OPTARG}
           ;;
        m) MEDIA_SERV_SSH_USER=${OPTARG}
           ;;
        :) printf "missing argument for -%s\n" "$OPTARG" >&2
           usage
           exit 1
           ;;
        \?) printf "illegal option: -%s\n" "$OPTARG" >&2
            usage
            exit 1
            ;;
    esac
done
shift $((OPTIND - 1))

ESC_SEQ="\x1b["
COL_RESET=$ESC_SEQ"39;49;00m"
COL_RED=$ESC_SEQ"31;01m"
COL_GREEN=$ESC_SEQ"32;01m"
COL_YELLOW=$ESC_SEQ"33;01m"

# INFO

echo -e $COL_YELLOW"Cloud address "$CLOUD_SSH_ADDR$COL_RESET
echo -e $COL_YELLOW"Cloud user "$CLOUD_SSH_USER$COL_RESET
echo -e $COL_YELLOW"Media server address "$MEDIA_SERV_SSH_ADDR$COL_RESET
echo -e $COL_YELLOW"Media server user "$MEDIA_SERV_SSH_USER$COL_RESET

####################################
###### SIGNALING SERVER DEPLOYMENT #
####################################

echo "Starting signaling server..."
ssh -o StrictHostKeyChecking=no -A $CLOUD_SSH_USER@$CLOUD_SSH_ADDR "
git clone git@github.com:Ullaakut/WebRTCCTV.git
cd WebRTCCTV
./docker-compose build
./docker-compose run -d -p 8443:8443 --name signaling --entrypoint bash signaling -c \"node server.js -k ws://" $MEDIA_SERV_SSH_ADDR ":8888/kurento -c " $CCTV_API_URL "\" signaling"

echo "Starting webapp..."
ssh -o StrictHostKeyChecking=no -A $CLOUD_SSH_USER@$CLOUD_SSH_ADDR "
git clone git@github.com:Ullaakut/WebRTCCTV.git
cd WebRTCCTV
./docker-compose build ;
./docker-compose run -d -p 80:80 -e SIGNALING_URI="$CLOUD_SSH_ADDR":8443 --name webapp webapp"

echo "Starting TURN server"
ssh -o StrictHostKeyChecking=no -A $CLOUD_SSH_USER@$CLOUD_SSH_ADDR "docker stop coturn; docker rm -f coturn ; docker run -d --net=host --name coturn ullaakut/dockurn ./turnserver -L0.0.0.0 --no-stun -v -f -a -r kurento.org -u kurento:kurento"

ret=$?
if [ "$ret" -ne "0" ]; then
    echo -e $COL_RED"The machine " $CLOUD_SSH_ADDR " was not accessible. The signaling server could not be deployed."$COL_RESET;
    exit 1;
fi

echo -e $COL_GREEN"The machine " $CLOUD_SSH_ADDR " was accessible and the signaling server should be started."$COL_RESET

###################################
######### MEDIA SERVER DEPLOYMENT #
###################################

echo "Starting Kurento Media Server on $MEDIA_SERV_SSH_ADDR..."

ssh -o StrictHostKeyChecking=no $MEDIA_SERV_SSH_USER@$MEDIA_SERV_SSH_ADDR "
docker rm -f kurento;
docker run -d --name kurento --cap-add=SETPCAP -e KMS_TURN_URL=kurento:kurento@"$CLOUD_SSH_ADDR":3478 -e OUTPUT_BITRATE=2048000 -p 8888:8888 ullaakut/kurento-custom-bitrate -e GST_DEBUG=Kurento*:5
"

ret=$?
if [ "$ret" -ne "0" ]; then
    echo -e $COL_RED"The test server was not acessible. Kurento could not be deployed."$COL_RESET;
    exit 1;
fi

echo -e $COL_GREEN"The test server was acessible and Kurento should be started."$COL_RESET

ssh $CLOUD_SSH_ADDR -l $CLOUD_SSH_USER "docker logs -ft signaling"