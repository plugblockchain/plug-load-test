# To run

***Note:*** Example for plug node from project's root

1. Spin up nodes
```
> cd plug-[version] && docker-compose up
```

2. Start sending transactions
```
> docker exec -it tx-app-node  node src/app.js --fund --period 1000 --plug --address 10.5.0.3 --stake 1
```
