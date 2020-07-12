#!/bin/bash

docker login -u $DOCKER_HUB_LOGIN -p $DOCKER_HUB_PASSWORD

export VERSION=$(cat .version)

docker tag orbsnetwork/rewards-service:$VERSION orbsnetworkstaging/rewards-service:$VERSION
docker push orbsnetworkstaging/rewards-service:$VERSION
