# To run

1. Spin up nodes
```
> docker-compose up
```

2. Start sending transactions
```
> node src/app.js --help
> node src/app.js \
    --fund \
    --period 100 \
    --address 127.0.0.1:9944 127.0.0.1:9945 127.0.0.1:9946 \
    --log-level trace
```
