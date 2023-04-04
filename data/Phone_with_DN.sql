-- List the DNs and their associated IP Phones
SELECT
  d.name,
  d.description,
  n.dnorpattern AS DN
FROM
  device AS d,
  numplan AS n,
  devicenumplanmap AS dnpm
WHERE
  dnpm.fkdevice = d.pkid
  AND dnpm.fknumplan = n.pkid
  AND d.tkclass = 1