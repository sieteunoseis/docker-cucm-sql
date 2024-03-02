SELECT
  COUNT(n.dnorpattern),
  rp.name AS partition,
  tpu.name AS PatternUsage
FROM
  numplan AS n
  INNER JOIN routepartition AS rp ON n.fkroutepartition = rp.pkid
  INNER JOIN typepatternusage AS tpu ON n.tkpatternusage = tpu.enum
GROUP BY
  rp.name,
  tpu.enum,
  tpu.name
ORDER BY
  rp.name