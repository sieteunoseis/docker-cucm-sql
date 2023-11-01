-- List the device information and DNs with associated partitions.
SELECT
  d.name,
  d.description,
  n.dnorpattern AS DN,
  rp.name AS PARTITION
FROM
  device AS d,
  numplan AS n,
  devicenumplanmap AS dnpm,
  routepartition AS rp
WHERE
  dnpm.fkdevice = d.pkid
  AND dnpm.fknumplan = n.pkid
  AND rp.pkid = n.fkroutepartition
  AND d.tkclass = 1
  AND d.description LIKE '%Jeremy%'