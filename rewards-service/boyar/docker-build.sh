#!/bin/bash

npm run build
docker build -t orbsnetworkstaging/rewards-service:$(cat .version) ./boyar
