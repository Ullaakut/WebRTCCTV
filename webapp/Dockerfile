FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY static /usr/share/nginx/html
COPY build_and_run.sh /build_and_run.sh

EXPOSE 80

ENTRYPOINT ["/build_and_run.sh"]
CMD ['/usr/sbin/nginx']
