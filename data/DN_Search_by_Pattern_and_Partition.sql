SELECT
  d.name,
  n.dnorpattern
FROM
  device d
  INNER JOIN devicenumplanmap dmap ON dmap.fkdevice = d.pkid
  INNER JOIN numplan n ON dmap.fknumplan = n.pkid
  INNER JOIN routepartition rp ON n.fkroutepartition = rp.pkid
WHERE
  LENGTH (n.dnorpattern) = 10 -- Length of DN pattern
  AND n.dnorpattern MATCHES '50355512[12345]*' -- Use regex to match your dial plan
  AND n.tkpatternusage = 2 -- Pattern is assigned to a device
  AND n.iscallable = 't' -- Is active number
  AND rp.name IN ('OnNet', 'DC_Lines_PT', 'NYC_Lines_PT') -- Search numbers in these partitions
ORDER BY
  d.name,
  n.dnorpattern