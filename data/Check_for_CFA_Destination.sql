SELECT
  n.dnorpattern,
  cfd.cfadestination,
  cfd.cfavoicemailenabled
FROM
  numplan n
  INNER JOIN callforwarddynamic AS cfd ON cfd.fknumplan = n.pkid
WHERE
  cfd.cfadestination LIKE 'Extension'
ORDER BY
  n.dnorpattern