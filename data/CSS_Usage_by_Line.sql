/*css distro for line level*/
SELECT
  css.name,
  COUNT(n.dnorpattern) AS ipline
FROM
  callingsearchspace css
  INNER JOIN numplan AS n ON n.fkcallingsearchspace_sharedlineappear = css.pkid
GROUP BY
  css.name