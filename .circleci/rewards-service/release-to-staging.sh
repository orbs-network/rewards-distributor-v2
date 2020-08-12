#!/bin/bash

docker login -u $DOCKER_HUB_LOGIN -p $DOCKER_HUB_PASSWORD

export VERSION=$(cat .version)

docker push orbsnetworkstaging/rewards-service:$VERSION

if [[ $CIRCLE_BRANCH == "master" ]] ;
then
  docker tag orbsnetworkstaging/rewards-service:$VERSION orbsnetworkstaging/rewards-service:experimental
  docker push orbsnetworkstaging/rewards-service:experimental
fi
