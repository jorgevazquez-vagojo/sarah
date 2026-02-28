# Janus Gateway — ARM64-native build
# Compiles Janus from source so it runs natively on aarch64 servers.
# Also works on amd64 (multi-arch via Docker buildx).
#
# Paths match the config: plugins at /usr/lib/janus/plugins
#                          transports at /usr/lib/janus/transports

FROM ubuntu:22.04 AS builder

ARG JANUS_VERSION=1.2.4

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential cmake autoconf automake libtool pkg-config gengetopt \
    libmicrohttpd-dev \
    libjansson-dev \
    libssl-dev \
    libsrtp2-dev \
    libsofia-sip-ua-dev \
    libglib2.0-dev \
    libopus-dev \
    libogg-dev \
    libcurl4-openssl-dev \
    libconfig-dev \
    libnice-dev \
    libwebsockets-dev \
    gtk-doc-tools \
    && rm -rf /var/lib/apt/lists/*

# Build usrsctp (data channels)
RUN git clone --depth 1 https://github.com/sctplab/usrsctp.git /tmp/usrsctp \
    && cd /tmp/usrsctp \
    && ./bootstrap \
    && ./configure --prefix=/usr \
    && make -j"$(nproc)" \
    && make install \
    && rm -rf /tmp/usrsctp

# Build Janus
RUN git clone --branch "v${JANUS_VERSION}" --depth 1 \
        https://github.com/meetecho/janus-gateway.git /tmp/janus \
    && cd /tmp/janus \
    && ./autogen.sh \
    && ./configure \
        --prefix=/usr \
        --libdir=/usr/lib \
        --enable-websockets \
        --enable-rest \
        --enable-sip \
        --disable-mqtt \
        --disable-rabbitmq \
        --disable-nanomsg \
        --disable-unix-sockets \
        --disable-docs \
    && make -j"$(nproc)" \
    && make install \
    && rm -rf /tmp/janus

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmicrohttpd12 \
    libjansson4 \
    libssl3 \
    libsrtp2-1 \
    libsofia-sip-ua0 \
    libglib2.0-0 \
    libopus0 \
    libogg0 \
    libcurl4 \
    libconfig9 \
    libnice10 \
    libwebsockets16 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy Janus binaries + libs from builder
COPY --from=builder /usr/bin/janus* /usr/bin/
COPY --from=builder /usr/lib/janus/ /usr/lib/janus/
COPY --from=builder /usr/lib/libsrtp2* /usr/lib/
COPY --from=builder /usr/lib/libusrsctp* /usr/lib/
COPY --from=builder /usr/share/janus/ /usr/share/janus/

# Shared libraries cache
RUN ldconfig

# Config dir (bind-mounted at runtime)
RUN mkdir -p /etc/janus /tmp/janus-recordings

EXPOSE 8088 8188 7088
EXPOSE 10000-10200/udp

ENTRYPOINT ["/usr/bin/janus"]
CMD ["--config=/etc/janus/janus.jcfg"]
