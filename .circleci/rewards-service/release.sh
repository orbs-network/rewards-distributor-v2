#!/bin/bash -e

if [[ $CIRCLE_TAG == v* ]] ;
then
  VERSION=$CIRCLE_TAG
else
  VERSION=experimental
fi

docker login -u $DOCKER_HUB_LOGIN -p $DOCKER_HUB_PASSWORD

docker tag orbsnetwork/rewards-service:$(cat .version) orbsnetwork/rewards-service:$VERSION
docker push orbsnetwork/rewards-service:$VERSION
