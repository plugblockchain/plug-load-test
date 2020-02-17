FROM alpine
LABEL maintainer="centrality.ai"
RUN apk add openrc
RUN apk add docker
RUN apk update
RUN rc-update add docker boot
RUN wget -P /var/run/ https://github.com/alexei-led/pumba/releases/download/0.6.5/pumba
RUN chmod +x /var/run/pumba
ENV PATH="${PATH}:/var/run"
CMD tail -f /dev/null
