# Janus Gateway — ARM64-native build
# Source is COPY'd from janus-gateway/ dir (pre-cloned on host).
# Run: git clone --branch v1.3.3 --depth 1 https://github.com/meetecho/janus-gateway.git janus/janus-gateway
# Then: docker build -t rdg-janus-arm64 ./janus
#
# Two-stage: compile on ubuntu:22.04, slim runtime image.

FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential autoconf automake libtool pkg-config gengetopt \
    libmicrohttpd-dev libjansson-dev libssl-dev libsrtp2-dev \
    libsofia-sip-ua-dev libglib2.0-dev libopus-dev libogg-dev \
    libcurl4-openssl-dev libconfig-dev libnice-dev libwebsockets-dev \
    gtk-doc-tools \
    && rm -rf /var/lib/apt/lists/*

COPY janus-gateway/ /tmp/janus/

RUN cd /tmp/janus \
    && ./autogen.sh \
    && ./configure \
        --prefix=/usr \
        --libdir=/usr/lib \
        --enable-websockets \
        --enable-rest \
        --enable-sip \
        --disable-data-channels \
        --disable-mqtt \
        --disable-rabbitmq \
        --disable-nanomsg \
        --disable-unix-sockets \
        --disable-docs \
    && make -j"$(nproc)" \
    && make install \
    && rm -rf /tmp/janus

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmicrohttpd12 libjansson4 libssl3 libsrtp2-1 \
    libsofia-sip-ua0 libglib2.0-0 libopus0 libogg0 \
    libcurl4 libconfig9 libnice10 libwebsockets16 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/bin/janus* /usr/bin/
COPY --from=builder /usr/lib/janus/ /usr/lib/janus/
COPY --from=builder /usr/lib/libsrtp2* /usr/lib/

RUN ldconfig && mkdir -p /etc/janus /tmp/janus-recordings

EXPOSE 8088 8188 7088
EXPOSE 10000-10200/udp

ENTRYPOINT ["/usr/bin/janus"]
CMD ["--config=/etc/janus/janus.jcfg"]
