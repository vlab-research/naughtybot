#!/bin/sh

# App
kubectl delete -f kube-dev
docker build -t localhost:32000/naughtybot:registry .
docker push localhost:32000/naughtybot:registry
kubectl apply -f kube-dev
