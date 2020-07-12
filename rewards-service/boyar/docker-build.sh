#!/bin/bash

npm run build
docker build -t orbsnetwork/rewards-service:$(cat .version) ./boyar
